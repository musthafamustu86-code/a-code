
-- Legacy rows lack the original enable flag. Keep that uncertainty explicit.
alter table public.attendance_sessions add column configured_reward integer check(configured_reward>=0), add column rewards_enabled boolean;
create function private.capture_activity_configuration() returns trigger language plpgsql set search_path='' as $$
begin
 select reward,reward_enabled into strict new.configured_reward,new.rewards_enabled from public.activities where id=new.activity_id;
 return new;
end $$;
create trigger snapshot_activity before insert on public.attendance_sessions for each row execute function private.capture_activity_configuration();
create function private.lock_session_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(NEW)-'status') is distinct from (to_jsonb(OLD)-'status') then raise exception 'Submitted snapshots are immutable'; end if;
 return NEW;
end $$;
create trigger lock_snapshot before update on public.attendance_sessions for each row execute function private.lock_session_snapshot();
create trigger lock_attendance_mark before update on public.attendance_records for each row execute function private.immutable();
create index attendance_record_session on public.attendance_records(session_id,full_name,id);
create index ledger_recent on public.star_transactions(created_at desc,id);
create function private.finalize_due_periods(actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record; today date; begin

 perform pg_advisory_xact_lock(781324);
 select (now() at time zone timezone)::date into today from public.institution_settings where id=1;
 for r in select * from public.recognition_periods where end_date<today and finalized_at is null order by end_date,category loop
  insert into public.recognition_winners(period_id,league_id,student_id,student_name,league_name,stars)
  select r.id,x.league_id,x.student_id,x.full_name,x.league_name,x.total from (
   select z.*,rank() over(partition by z.league_id order by z.total desc) as ranking from (
    select a.league_id,e.student_id,s.full_name,l.name league_name,coalesce(sum(t.amount),0) total
    from public.enrolments e join public.students s on s.id=e.student_id
    join public.league_assignments a on a.student_id=e.student_id and a.academic_year_id=e.academic_year_id
    join public.leagues l on l.id=a.league_id
    left join public.star_transactions t on t.student_id=e.student_id and t.academic_year_id=e.academic_year_id and t.earned_on between r.start_date and r.end_date
    where e.academic_year_id=r.academic_year_id and (r.category<>'week' or not exists (
     select 1 from public.recognition_winners w join public.recognition_periods p on p.id=w.period_id
     where w.student_id=e.student_id and w.league_id=a.league_id and p.academic_year_id=r.academic_year_id and p.category='week' and p.academic_month=r.academic_month
    )) group by a.league_id,e.student_id,s.full_name,l.name
   ) z where z.total>0
  ) x where x.ranking=1;
  update public.recognition_periods set finalized_at=now() where id=r.id;
  insert into public.audit_logs(action,staff_id,staff_name,related_id,after_data) values ('recognition.generate',actor,coalesce((select display_name from public.staff_profiles where id=actor),'Recognition scheduler'),r.id::text,to_jsonb(r));
 end loop;
end $$;
revoke all on function private.finalize_due_periods(uuid) from public,anon,authenticated;
create or replace function private.recognize() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required'; end if;
 perform private.finalize_due_periods(auth.uid());
end $$;
create or replace function public.overview() returns jsonb language plpgsql security invoker set search_path='' as $$
declare settings public.institution_settings; today date; week_start date; yr uuid; result jsonb; begin
 select * into settings from public.institution_settings where id=1;
 if settings.id is null then raise exception 'Staff access required'; end if;
 today=(now() at time zone settings.timezone)::date;
 week_start=today-((extract(dow from today)::int-settings.week_start+7)%7);
 select id into yr from public.academic_years where status='active';
 select coalesce((select start_date from public.recognition_periods where academic_year_id=yr and category='week' and today between start_date and end_date),week_start) into week_start;
 select jsonb_build_object('settings',to_jsonb(settings),'today',today,'week_start',week_start,'active_year',yr,
 'students',(select count(*) from public.students s join public.enrolments e on e.student_id=s.id where s.active and e.academic_year_id=yr and e.progression not in ('graduated','left')),
 'weekly_stars',(select coalesce(sum(amount),0) from public.star_transactions where academic_year_id=yr and earned_on between week_start and today),
 'attendance',(select round(100.0*count(*) filter(where r.present)/nullif(count(*),0),1) from public.attendance_records r join public.attendance_sessions s on s.id=r.session_id where s.attendance_date=today and s.status='active'),
 'recent',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (select * from public.star_transactions order by created_at desc limit 5)t)
 ) into result;
 return result;
end $$;

create or replace function public.rankings(p_year uuid,p_league uuid,p_start date,p_end date,p_search text default '',p_offset integer default 0,p_desc boolean default true) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r)),'[]'::jsonb) from (
 select * from (
 select s.id,s.full_name,s.admission_number,coalesce(sum(t.amount),0) stars,rank() over(order by coalesce(sum(t.amount),0) desc) rank,count(*) over() total_count
 from public.enrolments e join public.academic_years y on y.id=e.academic_year_id and y.status<>'draft' and (p_start is null or y.end_date>=p_start) and (p_end is null or y.start_date<=p_end) join public.students s on s.id=e.student_id join public.league_assignments a on a.student_id=e.student_id and a.academic_year_id=e.academic_year_id
 left join public.star_transactions t on t.student_id=e.student_id and t.academic_year_id=e.academic_year_id and (p_start is null or t.earned_on>=p_start) and (p_end is null or t.earned_on<=p_end)
 where (p_year is null or e.academic_year_id=p_year) and a.league_id=p_league
 group by s.id
 ) scores where full_name ilike '%'||p_search||'%' or admission_number ilike '%'||p_search||'%'
 order by case when p_desc then stars end desc,case when not p_desc then stars end asc,full_name,id limit 100 offset greatest(0,p_offset)
 ) r;
$$;
