-- Attendance forms can be assigned to classes, leagues and individual students.
-- Leagues and students are expanded to their classes so taking attendance only
-- has to read one list, and every two or more of the three modes can be combined.
create table if not exists public.activity_classes(
  activity_id uuid not null references public.activities on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  primary key(activity_id,class_id)
);
create table if not exists public.activity_leagues(
  activity_id uuid not null references public.activities on delete cascade,
  league_id uuid not null references public.leagues on delete cascade,
  primary key(activity_id,league_id)
);
create table if not exists public.activity_students(
  activity_id uuid not null references public.activities on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  primary key(activity_id,student_id)
);

alter table public.activity_classes enable row level security;
alter table public.activity_leagues enable row level security;
alter table public.activity_students enable row level security;
drop policy if exists staff_read on public.activity_classes;
drop policy if exists staff_read on public.activity_leagues;
drop policy if exists staff_read on public.activity_students;
create policy staff_read on public.activity_classes for select to authenticated using ((select private.is_staff()));
create policy staff_read on public.activity_leagues for select to authenticated using ((select private.is_staff()));
create policy staff_read on public.activity_students for select to authenticated using ((select private.is_staff()));
grant select on public.activity_classes, public.activity_leagues, public.activity_students to authenticated;
revoke all on public.activity_classes, public.activity_leagues, public.activity_students from anon;

create or replace function public.assign_activity_targets(p_activity uuid, p_classes uuid[], p_leagues uuid[], p_students uuid[])
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare yr uuid;
begin
  if not private.is_staff() then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_activity is null or not exists(select 1 from public.activities where id=p_activity) then
    raise exception 'Attendance form not found';
  end if;
  select id into yr from public.academic_years where status='active';

  delete from public.activity_classes where activity_id=p_activity;
  delete from public.activity_leagues where activity_id=p_activity;
  delete from public.activity_students where activity_id=p_activity;

  insert into public.activity_classes(activity_id,class_id)
    select p_activity,id from public.classes where active and id=any(coalesce(p_classes,'{}'::uuid[]));
  insert into public.activity_leagues(activity_id,league_id)
    select p_activity,id from public.leagues where id=any(coalesce(p_leagues,'{}'::uuid[]));
  insert into public.activity_students(activity_id,student_id)
    select p_activity,id from public.students where active and id=any(coalesce(p_students,'{}'::uuid[]));

  -- A league covers the classes mapped to it in the active academic year.
  if yr is not null then
    insert into public.activity_classes(activity_id,class_id)
      select distinct p_activity,cl.class_id
      from public.activity_leagues al join public.class_leagues cl on cl.league_id=al.league_id
      where al.activity_id=p_activity and cl.academic_year_id=yr
      on conflict do nothing;
    insert into public.activity_classes(activity_id,class_id)
      select distinct p_activity,e.class_id
      from public.activity_students ast
      join public.enrolments e on e.student_id=ast.student_id
      where ast.activity_id=p_activity and e.academic_year_id=yr
        and e.progression not in ('graduated','left')
      on conflict do nothing;
  end if;

  return jsonb_build_object(
    'classes',(select count(*) from public.activity_classes where activity_id=p_activity),
    'leagues',(select count(*) from public.activity_leagues where activity_id=p_activity),
    'students',(select count(*) from public.activity_students where activity_id=p_activity),
    'academic_year',yr
  );
end $$;
revoke all on function public.assign_activity_targets(uuid,uuid[],uuid[],uuid[]) from public, anon;
grant execute on function public.assign_activity_targets(uuid,uuid[],uuid[],uuid[]) to authenticated;
