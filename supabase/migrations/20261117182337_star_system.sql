-- STAR SYSTEM: single institution, equal staff permissions. No public registration.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.staff_profiles (
 id uuid primary key references auth.users(id), display_name text not null, active boolean not null default true
);
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.staff_profiles where id = auth.uid() and active);
$$;
revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to authenticated;

create table public.institution_settings (
 id integer primary key default 1 check(id=1), name text not null default 'Sincere Academy', timezone text not null default 'Asia/Kolkata',
 week_start integer not null default 1 check(week_start between 0 and 6), month_start_day integer not null default 1 check(month_start_day between 1 and 31),
 logo_path text, theme text not null default 'light' check(theme in ('light','dark'))
);
insert into public.institution_settings(id) values(1);
create table public.classes(id uuid primary key default gen_random_uuid(), name text not null unique, position integer not null default 0, active boolean not null default true);
insert into public.classes(name,position) values('6',1),('7',2),('8',3),('9',4),('10',5),('+1',6),('+2',7),('UG Students',8);
create table public.academic_years (
 id uuid primary key default gen_random_uuid(), name text not null unique, start_date date not null, end_date date not null check(end_date>=start_date),
 status text not null default 'draft' check(status in ('draft','active','closed')), confirmed_at timestamptz, created_at timestamptz not null default now()
);
create unique index one_active_year on public.academic_years(status) where status='active';
create table public.leagues(id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', color text not null default '#6c5ce7', active boolean not null default true);
create table public.students (
 id uuid primary key default gen_random_uuid(), admission_number text not null unique check(length(trim(admission_number)) between 1 and 80),
 full_name text not null check(length(trim(full_name)) between 1 and 200), photo_path text, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.enrolments (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students,
 academic_year_id uuid not null references public.academic_years, class_id uuid not null references public.classes,
 progression text not null default 'continuing' check(progression in ('continuing','promoted','graduated','left','new admission')),
 unique(student_id,academic_year_id)
);
create table public.league_assignments (
 id uuid primary key default gen_random_uuid(), student_id uuid not null, academic_year_id uuid not null,
 league_id uuid not null references public.leagues, unique(student_id,academic_year_id),
 foreign key(student_id,academic_year_id) references public.enrolments(student_id,academic_year_id)
);
create table public.activities (
 id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '',
 reward integer not null default 1 check(reward>=0), reward_enabled boolean not null default true, active boolean not null default true
);
create table public.pinned_forms (
 id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff_profiles, activity_id uuid not null references public.activities,
 position integer not null check(position between 1 and 8), unique(staff_id,activity_id), unique(staff_id,position)
);
create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(), academic_year_id uuid not null references public.academic_years, activity_id uuid not null references public.activities,
 attendance_date date not null, activity_name text not null, selected_classes jsonb not null, reward_snapshot integer not null check(reward_snapshot>=0),
 submitted_by uuid not null references public.staff_profiles, staff_name text not null, institution_name text not null, original_remarks text not null default '', submitted_at timestamptz not null default now(),
 status text not null default 'active' check(status in ('active','archived','trash')), request_id uuid not null unique
);
-- Class-level keys prevent overlapping class submissions, including concurrent requests.
create table private.attendance_keys (
 academic_year_id uuid not null, activity_id uuid not null, attendance_date date not null, class_id uuid not null,
 session_id uuid not null, primary key(academic_year_id,activity_id,attendance_date,class_id)
);
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.attendance_sessions on delete cascade,
 student_id uuid not null references public.students, full_name text not null, admission_number text not null, class_name text not null,
 present boolean not null, stars integer not null check(stars>=0), unique(session_id,student_id)
);
create table public.attendance_remarks (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.attendance_sessions on delete cascade, content text not null default ''
);
create table public.remark_history (
 id uuid primary key default gen_random_uuid(), session_id uuid not null, old_content text not null, new_content text not null,
 staff_id uuid not null references public.staff_profiles, created_at timestamptz not null default now()
);
create table public.attendance_lifecycle (
 id uuid primary key default gen_random_uuid(), session_id uuid not null, action text not null, staff_id uuid not null references public.staff_profiles, created_at timestamptz not null default now()
);
create table public.star_transactions (
 id uuid primary key default gen_random_uuid(), student_id uuid not null, academic_year_id uuid not null, league_id uuid references public.leagues,
 class_id uuid not null references public.classes, class_name text not null, student_name text not null, admission_number text not null,
 amount integer not null check(amount>0), reason text not null check(length(trim(reason))>0), source text not null check(source in ('attendance','manual')),
 session_id uuid, awarded_by uuid not null references public.staff_profiles, staff_name text not null,
 created_at timestamptz not null default now(), earned_on date not null, request_id uuid not null,
 foreign key(student_id,academic_year_id) references public.enrolments(student_id,academic_year_id),
 unique(request_id,student_id), check(source <> 'manual' or amount between 1 and 5)
);
create table public.recognition_periods (
 id uuid primary key default gen_random_uuid(), academic_year_id uuid not null references public.academic_years,
 category text not null check(category in ('week','month','quarter','year')), name text not null, start_date date not null, end_date date not null check(end_date>=start_date),
 academic_month date not null, finalized_at timestamptz,
 unique(academic_year_id,category,start_date)
);
create table public.recognition_winners (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references public.recognition_periods,
 league_id uuid not null references public.leagues, student_id uuid not null references public.students,
 student_name text not null, league_name text not null, stars bigint not null check(stars>0), created_at timestamptz not null default now(),
 unique(period_id,league_id,student_id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), action text not null, staff_id uuid references public.staff_profiles,
 staff_name text not null, related_id text, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
alter table public.institution_settings add constraint institution_name_required check(length(trim(name)) between 1 and 200);
alter table public.classes add constraint class_name_required check(length(trim(name)) between 1 and 120);
alter table public.leagues add constraint league_name_required check(length(trim(name)) between 1 and 120);
alter table public.activities add constraint activity_name_required check(length(trim(name)) between 1 and 120);
alter table public.academic_years add constraint year_name_required check(length(trim(name)) between 1 and 120);
alter table public.staff_profiles add constraint staff_name_required check(length(trim(display_name)) between 1 and 200);
create index ledger_student_date on public.star_transactions(student_id,earned_on);
create index ledger_year_league_date on public.star_transactions(academic_year_id,league_id,earned_on);
create index attendance_date_idx on public.attendance_sessions(attendance_date,activity_id);
create index records_student_idx on public.attendance_records(student_id,session_id);
create index enrolment_class_idx on public.enrolments(academic_year_id,class_id);
create index audit_date_idx on public.audit_logs(created_at desc);
create index remark_session_idx on public.remark_history(session_id,created_at);
create index recognition_year_idx on public.recognition_periods(academic_year_id,category,end_date);

-- Browser roles receive SELECT only. All writes go through checked, atomic commands.
do $$ declare t text; begin
 foreach t in array array['staff_profiles','institution_settings','classes','academic_years','leagues','students','enrolments','league_assignments','activities','attendance_sessions','attendance_records','attendance_remarks','remark_history','attendance_lifecycle','star_transactions','recognition_periods','recognition_winners','audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_staff()))',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.pinned_forms enable row level security;
create policy own_pins on public.pinned_forms for select to authenticated using(staff_id=(select auth.uid()) and (select private.is_staff()));
grant select on public.pinned_forms to authenticated;

create function private.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Historical records are immutable'; end $$;
create trigger immutable_ledger before update or delete on public.star_transactions for each row execute function private.immutable();
create trigger immutable_audit before update or delete on public.audit_logs for each row execute function private.immutable();
create trigger immutable_winners before update or delete on public.recognition_winners for each row execute function private.immutable();
create trigger immutable_remark_history before update or delete on public.remark_history for each row execute function private.immutable();
create function private.permanent_admission() returns trigger language plpgsql set search_path='' as $$ begin
 if new.admission_number is distinct from old.admission_number then raise exception 'Admission numbers are permanent'; end if;
 return new;
end $$;
create trigger permanent_admission before update on public.students for each row execute function private.permanent_admission();

create function private.audit(p_action text, p_id text, p_before jsonb, p_after jsonb) returns void language sql set search_path='' as $$
 insert into public.audit_logs(action,staff_id,staff_name,related_id,before_data,after_data)
 select p_action,auth.uid(),display_name,p_id,p_before,p_after from public.staff_profiles where id=auth.uid();
$$;

-- Awards are finalized only after configured periods close. Weekly rotation uses the
-- academic month containing the week's start. Zero-star students do not win.
create function private.recognize() returns void language plpgsql security definer set search_path='' as $$
declare r record; today date; begin
 if not private.is_staff() then raise exception 'Staff access required'; end if;
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
  perform private.audit('recognition.generate',r.id::text,null,to_jsonb(r));
 end loop;
end $$;

create function private.month_boundary(p_date date,p_day integer) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month',p_date)::date + (least(p_day,extract(day from (date_trunc('month',p_date)+interval '1 month - 1 day'))::int)-1));
$$;
create function private.command(p_action text, p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result_id uuid; yr public.academic_years; previous_year uuid; item jsonb; act public.activities;
 rec record; old_value jsonb; staff text; n integer; session_row public.attendance_sessions; today date; d date; finish date; anchor date; cat text;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 select display_name into staff from public.staff_profiles where id=uid;
 select (now() at time zone timezone)::date into today from public.institution_settings where id=1;
 perform pg_advisory_xact_lock(781325); -- serializes validation and writes across staff
 if p_action='student.save' then
  if p ? 'id' and nullif(p->>'id','') is not null then
   result_id=(p->>'id')::uuid;
   select to_jsonb(s) into old_value from public.students s where id=result_id;
   if old_value is null then raise exception 'Student not found'; end if;
   if p->>'admission_number' is distinct from old_value->>'admission_number' then raise exception 'Admission numbers are permanent'; end if;
   update public.students set full_name=trim(p->>'full_name'), active=coalesce((p->>'active')::boolean,true) where id=result_id;
  else
   select * into yr from public.academic_years where id=(p->>'academic_year_id')::uuid;
   if yr.id is null or yr.status='closed' then raise exception 'Choose an active or draft academic year'; end if;
   insert into public.students(full_name,admission_number) values(trim(p->>'full_name'),trim(p->>'admission_number')) returning id into result_id;
   insert into public.enrolments(student_id,academic_year_id,class_id,progression) values(result_id,yr.id,(p->>'class_id')::uuid,'new admission');
   if nullif(p->>'league_id','') is not null then insert into public.league_assignments(student_id,academic_year_id,league_id) values(result_id,yr.id,(p->>'league_id')::uuid); end if;
  end if;
 elsif p_action='students.import' then
  if jsonb_array_length(p->'rows')>500 then raise exception 'Import at most 500 students per batch'; end if;
  for item in select value from jsonb_array_elements(p->'rows') loop
   perform private.command('student.save',item || jsonb_build_object('academic_year_id',p->>'academic_year_id'));
  end loop;
 elsif p_action='year.create' then
  if exists(select 1 from public.academic_years where status='draft') then raise exception 'Confirm the existing draft year first'; end if;
  if exists(select 1 from public.academic_years where daterange(start_date,end_date,'[]') && daterange((p->>'start_date')::date,(p->>'end_date')::date,'[]')) then raise exception 'Academic years cannot overlap'; end if;
  insert into public.academic_years(name,start_date,end_date) values(trim(p->>'name'),(p->>'start_date')::date,(p->>'end_date')::date) returning id into result_id;
  select id into previous_year from public.academic_years where status='active';
  insert into public.enrolments(student_id,academic_year_id,class_id,progression) select student_id,result_id,class_id,'continuing' from public.enrolments e join public.students s on s.id=e.student_id where e.academic_year_id=previous_year and s.active and e.progression not in ('graduated','left');
  insert into public.league_assignments(student_id,academic_year_id,league_id) select a.student_id,result_id,a.league_id from public.league_assignments a join public.enrolments e on e.student_id=a.student_id and e.academic_year_id=result_id where a.academic_year_id=previous_year;
 elsif p_action='enrolment.save' then
  select to_jsonb(e)||jsonb_build_object('league_id',a.league_id) into old_value from public.enrolments e left join public.league_assignments a on a.student_id=e.student_id and a.academic_year_id=e.academic_year_id where e.student_id=(p->>'student_id')::uuid and e.academic_year_id=(p->>'academic_year_id')::uuid;
  if old_value is null then raise exception 'Student enrolment not found'; end if;
  select * into yr from public.academic_years where id=(p->>'academic_year_id')::uuid;
  if yr.status is distinct from 'draft' then raise exception 'Progression and league changes require a draft year'; end if;
  update public.enrolments set class_id=(p->>'class_id')::uuid,progression=p->>'progression' where student_id=(p->>'student_id')::uuid and academic_year_id=yr.id;
  delete from public.league_assignments where student_id=(p->>'student_id')::uuid and academic_year_id=yr.id;
  if nullif(p->>'league_id','') is not null then insert into public.league_assignments(student_id,academic_year_id,league_id) values((p->>'student_id')::uuid,yr.id,(p->>'league_id')::uuid); end if;
 elsif p_action='year.confirm' then
  select * into yr from public.academic_years where id=(p->>'id')::uuid for update;
  if yr.status is distinct from 'draft' then raise exception 'Choose a draft year'; end if;
  old_value=to_jsonb(yr);
  if exists(select 1 from public.enrolments e where e.academic_year_id=yr.id and e.progression not in ('graduated','left') and not exists(select 1 from public.league_assignments a where a.student_id=e.student_id and a.academic_year_id=yr.id)) then raise exception 'Assign a league to every continuing student before confirmation'; end if;
  update public.academic_years set status='closed' where status='active';
  update public.academic_years set status='active',confirmed_at=now() where id=yr.id;
  -- Calendar periods are materialized so later preference changes cannot rewrite history.
  foreach cat in array array['week','month','quarter','year'] loop
   d=yr.start_date;
   while d<=yr.end_date loop
    if cat='week' then select d+((week_start-extract(dow from d)::int+6)%7) into finish from public.institution_settings;
    elsif cat='month' then select (case when private.month_boundary(d,month_start_day)>d then private.month_boundary(d,month_start_day) else private.month_boundary((date_trunc('month',d)+interval '1 month')::date,month_start_day) end)-1 into finish from public.institution_settings;
    elsif cat='quarter' then finish=(d+interval '3 months')::date-1;
    else finish=yr.end_date; end if;
    finish=least(finish,yr.end_date);
    select case when d>=private.month_boundary(d,month_start_day) then private.month_boundary(d,month_start_day) else private.month_boundary((date_trunc('month',d)-interval '1 month')::date,month_start_day) end into anchor from public.institution_settings;
    insert into public.recognition_periods(academic_year_id,category,name,start_date,end_date,academic_month) values(yr.id,cat,initcap(cat)||' · '||d::text,d,finish,anchor);
    d=finish+1;
   end loop;
  end loop;
  result_id=yr.id;
 elsif p_action in ('league.save','activity.save','class.save') then
  result_id=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  if p_action='league.save' then
   insert into public.leagues(id,name,description,color,active) values(result_id,trim(p->>'name'),coalesce(p->>'description',''),coalesce(p->>'color','#6c5ce7'),coalesce((p->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,description=excluded.description,color=excluded.color,active=excluded.active;
  elsif p_action='activity.save' then
   insert into public.activities(id,name,description,reward,reward_enabled,active) values(result_id,trim(p->>'name'),coalesce(p->>'description',''),(p->>'reward')::integer,coalesce((p->>'reward_enabled')::boolean,true),coalesce((p->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,description=excluded.description,reward=excluded.reward,reward_enabled=excluded.reward_enabled,active=excluded.active;
  else insert into public.classes(id,name,position,active) values(result_id,trim(p->>'name'),coalesce((p->>'position')::int,0),coalesce((p->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,position=excluded.position,active=excluded.active;
  end if;
 elsif p_action='pin.toggle' then
  if exists(select 1 from public.pinned_forms where staff_id=uid and activity_id=(p->>'activity_id')::uuid) then delete from public.pinned_forms where staff_id=uid and activity_id=(p->>'activity_id')::uuid;
  else
   select min(v) into n from generate_series(1,8) v where not exists(select 1 from public.pinned_forms where staff_id=uid and position=v);
   if n is null then raise exception 'You can pin up to 8 forms. Unpin a form first.'; end if;
   insert into public.pinned_forms(staff_id,activity_id,position) values(uid,(p->>'activity_id')::uuid,n);
  end if;
 elsif p_action='attendance.submit' then
  select * into yr from public.academic_years where status='active';
  if yr.id is null then raise exception 'Activate an academic year first'; end if;
  d=(p->>'date')::date;
  if d not between yr.start_date and yr.end_date or d>today then raise exception 'Attendance date must be within the active year and not in the future'; end if;
  select * into act from public.activities where id=(p->>'activity_id')::uuid and active;
  if act.id is null then raise exception 'Select an active attendance form'; end if;
  if p ? 'expected_reward' and (p->>'expected_reward')::int is distinct from (case when act.reward_enabled then act.reward else 0 end) then raise exception 'The activity reward changed. Reload and review attendance before submitting.'; end if;
  if jsonb_array_length(p->'classes')<1 then raise exception 'Select at least one class'; end if;
  if (select count(distinct value) from jsonb_array_elements_text(p->'classes'))<>(select count(*) from public.classes where active and id in(select value::uuid from jsonb_array_elements_text(p->'classes'))) then raise exception 'Choose existing active classes'; end if;
  insert into public.attendance_sessions(academic_year_id,activity_id,attendance_date,activity_name,selected_classes,reward_snapshot,submitted_by,staff_name,institution_name,original_remarks,request_id)
  values(yr.id,act.id,d,act.name,(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.classes c where c.id in(select value::uuid from jsonb_array_elements_text(p->'classes'))),case when act.reward_enabled then act.reward else 0 end,uid,staff,(select name from public.institution_settings where id=1),coalesce(p->>'remarks',''),(p->>'request_id')::uuid) returning id into result_id;
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
   n=case when (item->>'present')::boolean and act.reward_enabled then act.reward else 0 end;
   insert into public.attendance_records(session_id,student_id,full_name,admission_number,class_name,present,stars) values(result_id,rec.id,rec.full_name,rec.admission_number,rec.class_name,(item->>'present')::boolean,n);
   if n>0 then insert into public.star_transactions(student_id,academic_year_id,league_id,class_id,class_name,student_name,admission_number,amount,reason,source,session_id,awarded_by,staff_name,earned_on,request_id) values(rec.id,yr.id,rec.league_id,rec.class_id,rec.class_name,rec.full_name,rec.admission_number,n,act.name,'attendance',result_id,uid,staff,d,(p->>'request_id')::uuid); end if;
  end loop;
  insert into public.attendance_remarks(session_id,content) values(result_id,coalesce(p->>'remarks',''));
 elsif p_action='stars.award' then
  select * into yr from public.academic_years where status='active';
  if yr.id is null or today not between yr.start_date and yr.end_date then raise exception 'Activate an academic year containing today'; end if;
  if (p->>'amount')::int not between 1 and 5 or length(trim(coalesce(p->>'reason','')))=0 then raise exception 'A reason and 1–5 stars per student are required'; end if;
  if jsonb_array_length(p->'students')<1 then raise exception 'Select at least one student'; end if;
  for item in select value from jsonb_array_elements(p->'students') loop
   select s.*,c.id class_id,c.name class_name,a.league_id into rec from public.students s join public.enrolments e on e.student_id=s.id and e.academic_year_id=yr.id and e.progression not in ('graduated','left') join public.classes c on c.id=e.class_id left join public.league_assignments a on a.student_id=s.id and a.academic_year_id=yr.id where s.id=(item#>>'{}')::uuid and s.active;
   if rec.id is null then raise exception 'Student is not actively enrolled'; end if;
   insert into public.star_transactions(student_id,academic_year_id,league_id,class_id,class_name,student_name,admission_number,amount,reason,source,awarded_by,staff_name,earned_on,request_id) values(rec.id,yr.id,rec.league_id,rec.class_id,rec.class_name,rec.full_name,rec.admission_number,(p->>'amount')::int,trim(p->>'reason'),'manual',uid,staff,today,(p->>'request_id')::uuid);
  end loop;
 elsif p_action='remark.save' then
  select to_jsonb(r) into old_value from public.attendance_remarks r where session_id=(p->>'session_id')::uuid for update;
  if old_value is null then raise exception 'Attendance session not found'; end if;
  update public.attendance_remarks set content=p->>'content' where session_id=(p->>'session_id')::uuid;
  insert into public.remark_history(session_id,old_content,new_content,staff_id) values((p->>'session_id')::uuid,old_value->>'content',p->>'content',uid);
 elsif p_action='attendance.lifecycle' then
  select * into session_row from public.attendance_sessions where id=(p->>'id')::uuid for update;
  if session_row.id is null then raise exception 'Session not found'; end if;
  old_value=to_jsonb(session_row); result_id=session_row.id;
  if p->>'status'='delete' then
   if session_row.status<>'trash' or p->>'confirmation' is distinct from 'DELETE' then raise exception 'Move the session to Trash and confirm DELETE first'; end if;
   delete from public.attendance_sessions where id=result_id;
   -- Ledger, duplicate keys, lifecycle and audit entries deliberately survive deletion.
  else update public.attendance_sessions set status=p->>'status' where id=result_id; end if;
  insert into public.attendance_lifecycle(session_id,action,staff_id) values(result_id,p->>'status',uid);
 elsif p_action='branding.save' then
  if split_part(p->>'path','/',1)<>'branding' or not exists(select 1 from storage.objects where bucket_id='student-photos' and name=p->>'path') then raise exception 'Upload an institution logo first'; end if;
  update public.institution_settings set logo_path=p->>'path' where id=1;
 elsif p_action='photo.save' then
  if not exists(select 1 from storage.objects where bucket_id='student-photos' and name=p->>'path') then raise exception 'Upload a photo first'; end if;
  if split_part(p->>'path','/',1) is distinct from p->>'student_id' then raise exception 'Photo must belong to the student'; end if;
  update public.students set photo_path=p->>'path' where id=(p->>'student_id')::uuid;
 elsif p_action='settings.save' then
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Unknown institution time zone'; end if;
  select to_jsonb(s) into old_value from public.institution_settings s where id=1;
  update public.institution_settings set name=trim(p->>'name'),timezone=p->>'timezone',week_start=(p->>'week_start')::int,month_start_day=(p->>'month_start_day')::int,theme=p->>'theme' where id=1;
 elsif p_action='period.save' then
  select to_jsonb(r) into old_value from public.recognition_periods r where id=(p->>'id')::uuid;
  if old_value is null or (old_value->>'end_date')::date<today or old_value->>'finalized_at' is not null then raise exception 'Closed recognition periods cannot change'; end if;
  select * into yr from public.academic_years where id=(old_value->>'academic_year_id')::uuid;
  if (p->>'start_date')::date<yr.start_date or (p->>'end_date')::date>yr.end_date then raise exception 'Recognition boundaries must stay within their academic year'; end if;
  if exists(select 1 from public.recognition_periods r where r.id<>(p->>'id')::uuid and r.academic_year_id=(old_value->>'academic_year_id')::uuid and r.category=old_value->>'category' and daterange(r.start_date,r.end_date,'[]') && daterange((p->>'start_date')::date,(p->>'end_date')::date,'[]')) then raise exception 'Recognition periods cannot overlap'; end if;
  update public.recognition_periods set name=p->>'name',start_date=(p->>'start_date')::date,end_date=(p->>'end_date')::date,academic_month=(p->>'academic_month')::date where id=(p->>'id')::uuid;
 elsif p_action='recognition.generate' then perform private.recognize();
 else raise exception 'Unknown operation'; end if;
 perform private.audit(p_action,coalesce(result_id::text,p->>'id',p->>'session_id'),old_value,p - 'request_id');
 return jsonb_build_object('id',result_id);
end $$;

create function public.command(p_action text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.command(p_action,p); $$;
revoke all on all functions in schema private from public;
grant execute on function private.is_staff(),private.command(text,jsonb) to authenticated;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;

create function public.rankings(p_year uuid,p_league uuid,p_start date,p_end date,p_search text default '',p_offset integer default 0,p_desc boolean default true) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r)),'[]'::jsonb) from (
 select * from (
 select s.id,s.full_name,s.admission_number,coalesce(sum(t.amount),0) stars,rank() over(order by coalesce(sum(t.amount),0) desc) rank,count(*) over() total_count
 from public.enrolments e join public.students s on s.id=e.student_id join public.league_assignments a on a.student_id=e.student_id and a.academic_year_id=e.academic_year_id
 left join public.star_transactions t on t.student_id=e.student_id and t.academic_year_id=e.academic_year_id and (p_start is null or t.earned_on>=p_start) and (p_end is null or t.earned_on<=p_end)
 where (p_year is null or e.academic_year_id=p_year) and a.league_id=p_league
 group by s.id
 ) scores where full_name ilike '%'||p_search||'%' or admission_number ilike '%'||p_search||'%'
 order by case when p_desc then stars end desc,case when not p_desc then stars end asc,full_name limit 100 offset greatest(0,p_offset)
 ) r;
$$;
revoke all on function public.rankings(uuid,uuid,date,date,text,integer,boolean) from public,anon;
grant execute on function public.rankings(uuid,uuid,date,date,text,integer,boolean) to authenticated;

create function public.overview() returns jsonb language plpgsql security invoker set search_path='' as $$
declare settings public.institution_settings; today date; week_start date; yr uuid; result jsonb; begin
 select * into settings from public.institution_settings where id=1;
 if settings.id is null then raise exception 'Staff access required'; end if;
 today=(now() at time zone settings.timezone)::date;
 week_start=today-((extract(dow from today)::int-settings.week_start+7)%7);
 select id into yr from public.academic_years where status='active';
 select jsonb_build_object('settings',to_jsonb(settings),'today',today,'week_start',week_start,'active_year',yr,
 'students',(select count(*) from public.students s join public.enrolments e on e.student_id=s.id where s.active and e.academic_year_id=yr and e.progression not in ('graduated','left')),
 'weekly_stars',(select coalesce(sum(amount),0) from public.star_transactions where earned_on between week_start and today),
 'attendance',(select round(100.0*count(*) filter(where r.present)/nullif(count(*),0),1) from public.attendance_records r join public.attendance_sessions s on s.id=r.session_id where s.attendance_date=today),
 'recent',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (select * from public.star_transactions order by created_at desc limit 5)t)
 ) into result;
 return result;
end $$;
revoke all on function public.overview() from public,anon;
grant execute on function public.overview() to authenticated;

create view public.student_directory with (security_invoker=true) as
 select s.*,e.academic_year_id,e.class_id,c.name class_name,e.progression,a.league_id,l.name league_name
 from public.students s join public.enrolments e on e.student_id=s.id
 join public.classes c on c.id=e.class_id
 left join public.league_assignments a on a.student_id=s.id and a.academic_year_id=e.academic_year_id
 left join public.leagues l on l.id=a.league_id;
grant select on public.student_directory to authenticated;

create view public.recognition_directory with (security_invoker=true) as
 select w.*,p.academic_year_id,p.category,p.start_date,p.end_date,p.name period_name from public.recognition_winners w join public.recognition_periods p on p.id=w.period_id;
grant select on public.recognition_directory to authenticated;

create function public.attendance_search(p jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
 select s.* from public.attendance_sessions s
 where (coalesce(p->>'status','')='' or s.status=p->>'status')
 and (coalesce(p->>'year','')='' or s.academic_year_id=(p->>'year')::uuid)
 and (coalesce(p->>'activity','')='' or s.activity_id=(p->>'activity')::uuid)
 and (coalesce(p->>'staff','')='' or s.submitted_by=(p->>'staff')::uuid)
 and (coalesce(p->>'class','')='' or s.selected_classes @> jsonb_build_array(jsonb_build_object('id',p->>'class')))
 and (coalesce(p->>'start','')='' or s.attendance_date>=(p->>'start')::date)
 and (coalesce(p->>'end','')='' or s.attendance_date<=(p->>'end')::date)
 and (coalesce(p->>'student','')='' or exists(select 1 from public.attendance_records a where a.session_id=s.id and (a.admission_number=p->>'student' or a.full_name ilike '%'||(p->>'student')||'%')))
 and (coalesce(p->>'search','')='' or s.activity_name ilike '%'||(p->>'search')||'%' or s.staff_name ilike '%'||(p->>'search')||'%' or exists(select 1 from public.attendance_records a where a.session_id=s.id and (a.admission_number=p->>'search' or a.full_name ilike '%'||(p->>'search')||'%')))
 order by s.attendance_date desc,s.submitted_at desc,s.id limit 100 offset greatest(0,coalesce((p->>'offset')::int,0))
 )r;
$$;
revoke all on function public.attendance_search(jsonb) from public,anon;
grant execute on function public.attendance_search(jsonb) to authenticated;

create function public.star_trend() returns jsonb language sql stable security invoker set search_path='' as $$
 with dates as (select ((now() at time zone timezone)::date-n) d from public.institution_settings cross join generate_series(0,6)n where id=1)
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select d date,coalesce(sum(t.amount),0) stars from dates left join public.star_transactions t on t.earned_on=dates.d group by d order by d)r;
$$;
revoke all on function public.star_trend() from public,anon;
grant execute on function public.star_trend() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy staff_photo_read on storage.objects for select to authenticated using(bucket_id='student-photos' and (select private.is_staff()));
create policy staff_photo_insert on storage.objects for insert to authenticated with check(bucket_id='student-photos' and (select private.is_staff()));
create policy staff_photo_delete on storage.objects for delete to authenticated using(bucket_id='student-photos' and (select private.is_staff()));


