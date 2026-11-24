-- A session now records when it happened and whether its stars were awarded.
alter table public.attendance_sessions
  add column if not exists attendance_time time,
  add column if not exists stars_awarded boolean not null default true;

-- Attendance submission with a session time and a per-session choice between
-- awarding the form's stars and storing marks only. Mirrors command's
-- attendance.submit rules, including the authoritative roster check.
create or replace function private.submit_attendance(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result_id uuid; yr public.academic_years; act public.activities;
 item jsonb; rec record; staff text; n integer; today date; d date; t time; award boolean;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 select display_name into staff from public.staff_profiles where id=uid;
 select (now() at time zone timezone)::date into today from public.institution_settings where id=1;
 perform pg_advisory_xact_lock(781325);
 select * into yr from public.academic_years where status='active';
 if yr.id is null then raise exception 'Activate an academic year first'; end if;
 d=(p->>'date')::date;
 if d not between yr.start_date and yr.end_date or d>today then raise exception 'Attendance date must be within the active year and not in the future'; end if;
 t=nullif(p->>'time','')::time;
 if t is null then raise exception 'Choose the session time'; end if;
 select * into act from public.activities where id=(p->>'activity_id')::uuid and active;
 if act.id is null then raise exception 'Select an active attendance form'; end if;
 award=coalesce((p->>'award_stars')::boolean,true);
 if p ? 'expected_reward' and (p->>'expected_reward')::int is distinct from (case when award and act.reward_enabled then act.reward else 0 end) then raise exception 'The activity reward changed. Reload and review attendance before submitting.'; end if;
 if jsonb_array_length(p->'classes')<1 then raise exception 'Select at least one class'; end if;
 if (select count(distinct value) from jsonb_array_elements_text(p->'classes'))<>(select count(*) from public.classes where active and id in(select value::uuid from jsonb_array_elements_text(p->'classes'))) then raise exception 'Choose existing active classes'; end if;
 insert into public.attendance_sessions(academic_year_id,activity_id,attendance_date,attendance_time,activity_name,selected_classes,reward_snapshot,stars_awarded,submitted_by,staff_name,institution_name,original_remarks,request_id)
 values(yr.id,act.id,d,t,act.name,(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.classes c where c.id in(select value::uuid from jsonb_array_elements_text(p->'classes'))),case when award and act.reward_enabled then act.reward else 0 end,award,uid,staff,(select name from public.institution_settings where id=1),coalesce(p->>'remarks',''),(p->>'request_id')::uuid) returning id into result_id;
 insert into private.attendance_keys select yr.id,act.id,d,value::uuid,result_id from jsonb_array_elements_text(p->'classes');
 -- Compare the exact submitted roster against the authoritative applicable roster.
 if exists(
  (select e.student_id from public.enrolments e join public.students s on s.id=e.student_id where e.academic_year_id=yr.id and s.active and e.progression not in ('graduated','left') and e.class_id in(select value::uuid from jsonb_array_elements_text(p->'classes')) except select (value->>'student_id')::uuid from jsonb_array_elements(p->'records'))
  union all
  (select (value->>'student_id')::uuid from jsonb_array_elements(p->'records') except select e.student_id from public.enrolments e join public.students s on s.id=e.student_id where e.academic_year_id=yr.id and s.active and e.progression not in ('graduated','left') and e.class_id in(select value::uuid from jsonb_array_elements_text(p->'classes')))
 ) then raise exception 'Student roster changed. Reload attendance before submitting.'; end if;
 if jsonb_array_length(p->'records')=0 then raise exception 'No applicable students'; end if;
 for item in select value from jsonb_array_elements(p->'records') loop
  select s.*,c.id class_id,c.name class_name,a.league_id into rec from public.students s join public.enrolments e on e.student_id=s.id and e.academic_year_id=yr.id join public.classes c on c.id=e.class_id left join public.league_assignments a on a.student_id=s.id and a.academic_year_id=yr.id where s.id=(item->>'student_id')::uuid;
  if jsonb_typeof(item->'present') is distinct from 'boolean' then raise exception 'Every attendance status is required'; end if;
  n=case when (item->>'present')::boolean and award and act.reward_enabled then act.reward else 0 end;
  insert into public.attendance_records(session_id,student_id,full_name,admission_number,class_name,present,stars) values(result_id,rec.id,rec.full_name,rec.admission_number,rec.class_name,(item->>'present')::boolean,n);
  if n>0 then insert into public.star_transactions(student_id,academic_year_id,league_id,class_id,class_name,student_name,admission_number,amount,reason,source,session_id,awarded_by,staff_name,earned_on,request_id) values(rec.id,yr.id,rec.league_id,rec.class_id,rec.class_name,rec.full_name,rec.admission_number,n,act.name,'attendance',result_id,uid,staff,d,(p->>'request_id')::uuid); end if;
 end loop;
 insert into public.attendance_remarks(session_id,content) values(result_id,coalesce(p->>'remarks',''));
 perform private.audit('attendance.submit',result_id::text,null,p - 'request_id');
 return jsonb_build_object('id',result_id);
end $$;

create or replace function public.submit_attendance(p jsonb) returns jsonb
language sql set search_path='' as $$ select private.submit_attendance(p); $$;

revoke all on function private.submit_attendance(jsonb) from public, anon, authenticated;
grant execute on function private.submit_attendance(jsonb) to authenticated;
revoke all on function public.submit_attendance(jsonb) from public, anon;
grant execute on function public.submit_attendance(jsonb) to authenticated;
