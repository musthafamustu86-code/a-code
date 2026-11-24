-- Leagues group classes: one league covers several classes, mapped per academic year.
create table if not exists public.class_leagues(
  academic_year_id uuid not null references public.academic_years on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  league_id uuid not null references public.leagues,
  primary key(academic_year_id,class_id)
);

alter table public.class_leagues enable row level security;
drop policy if exists staff_read on public.class_leagues;
create policy staff_read on public.class_leagues
  for select to authenticated using ((select private.is_staff()));
grant select on public.class_leagues to authenticated;

-- A new academic year inherits the active year's class-to-league mapping.
create or replace function private.seed_class_leagues() returns trigger
language plpgsql security definer set search_path=public,private as $$
begin
  insert into public.class_leagues(academic_year_id,class_id,league_id)
  select new.id,class_id,league_id from public.class_leagues
  where academic_year_id=(select id from public.academic_years where status='active' and id<>new.id limit 1)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists academic_years_seed_class_leagues on public.academic_years;
create trigger academic_years_seed_class_leagues after insert on public.academic_years
for each row execute function private.seed_class_leagues();

-- Set the classes a league covers for one year, move enrolled students, and
-- report per class what succeeded or failed so the UI can show ticks and crosses.
create or replace function public.assign_league_classes(p_year uuid, p_league uuid, p_classes uuid[])
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare
  lg text;
  item record;
  report jsonb := '[]'::jsonb;
  moved integer;
begin
  if not private.is_staff() then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_year is null or not exists(select 1 from public.academic_years where id=p_year) then
    raise exception 'Choose an academic year';
  end if;
  select name into lg from public.leagues where id=p_league;
  if lg is null then raise exception 'Choose a league'; end if;
  if p_classes is null then p_classes := '{}'; end if;

  -- Classes detached from this league: the mapping goes, student leagues stay.
  for item in
    select c.id,c.name from public.class_leagues cl
    join public.classes c on c.id=cl.class_id
    where cl.academic_year_id=p_year and cl.league_id=p_league
      and not(cl.class_id=any(p_classes))
    order by c.position,c.name
  loop
    begin
      delete from public.class_leagues
      where academic_year_id=p_year and class_id=item.id and league_id=p_league;
      report := report || jsonb_build_array(jsonb_build_object(
        'class_id',item.id,'class',item.name,'ok',true,'detached',true,
        'message',format('Removed from %s. Its students keep their current league.',lg)
      ));
    exception when others then
      report := report || jsonb_build_array(jsonb_build_object(
        'class_id',item.id,'class',item.name,'ok',false,'detached',true,
        'message',format('Could not remove this class: %s',sqlerrm)
      ));
    end;
  end loop;

  -- Unknown class ids (deleted or stale screen).
  for item in
    select x.id from unnest(p_classes) x(id)
    where not exists(select 1 from public.classes c where c.id=x.id)
  loop
    report := report || jsonb_build_array(jsonb_build_object(
      'class_id',item.id,'class','Unknown class','ok',false,'detached',false,
      'message','This class no longer exists. Refresh the page and try again.'
    ));
  end loop;

  for item in
    select c.id,c.name from public.classes c
    where c.id=any(p_classes)
    order by c.position,c.name
  loop
    begin
      insert into public.class_leagues(academic_year_id,class_id,league_id)
      values(p_year,item.id,p_league)
      on conflict(academic_year_id,class_id) do update set league_id=excluded.league_id;

      insert into public.league_assignments(student_id,academic_year_id,league_id)
      select e.student_id,e.academic_year_id,p_league from public.enrolments e
      where e.academic_year_id=p_year and e.class_id=item.id
      on conflict(student_id,academic_year_id) do update set league_id=excluded.league_id;
      get diagnostics moved = row_count;

      report := report || jsonb_build_array(jsonb_build_object(
        'class_id',item.id,'class',item.name,'ok',true,'detached',false,'students',moved,
        'message',case when moved=0
          then format('Assigned to %s. No students are enrolled in this class yet.',lg)
          else format('%s %s moved into %s.',moved,
            case when moved=1 then 'student' else 'students' end,lg) end
      ));
    exception when others then
      report := report || jsonb_build_array(jsonb_build_object(
        'class_id',item.id,'class',item.name,'ok',false,'detached',false,
        'message',format('Could not assign this class: %s',sqlerrm)
      ));
    end;
  end loop;

  return jsonb_build_object(
    'league',lg,
    'summary',report,
    'classes',jsonb_array_length(report),
    'failed',(select count(*) from jsonb_array_elements(report) e where not (e->>'ok')::boolean)
  );
end $$;

revoke all on function public.assign_league_classes(uuid,uuid,uuid[]) from public, anon;
grant execute on function public.assign_league_classes(uuid,uuid,uuid[]) to authenticated;
