-- Individual rankings can be limited to one league, so every league gets its
-- own leaderboard and ranks are computed inside that league.
drop function if exists public.individual_rankings(uuid,date,date,text,integer,boolean,integer,boolean);

create function public.individual_rankings(p_year uuid default null, p_start date default null, p_end date default null,
 p_search text default '', p_offset integer default 0, p_desc boolean default true, p_limit integer default 100,
 p_current_week boolean default false, p_league uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; today date; first_day integer;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_current_week then
  select (now() at time zone timezone)::date, week_start into today,first_day from public.institution_settings where id=1;
  select id into p_year from public.academic_years where status='active' and today between start_date and end_date;
  if p_year is null then return '[]'::jsonb; end if;
  select start_date into p_start from public.recognition_periods where academic_year_id=p_year and category='week' and today between start_date and end_date;
  p_start=coalesce(p_start,today-((extract(dow from today)::integer-first_day+7)%7)); p_end=today;
 end if;
 with scores as (
  select s.id,s.full_name,s.admission_number,coalesce(sum(t.amount),0) stars
  from public.students s join public.enrolments e on e.student_id=s.id
  join public.academic_years y on y.id=e.academic_year_id and y.status<>'draft'
  left join public.star_transactions t on t.student_id=e.student_id and t.academic_year_id=e.academic_year_id
   and (p_start is null or t.earned_on>=p_start) and (p_end is null or t.earned_on<=p_end)
  where (p_year is null or y.id=p_year) and (p_start is null or y.end_date>=p_start) and (p_end is null or y.start_date<=p_end)
   and (p_league is null or exists(
    select 1 from public.league_assignments la
    where la.student_id=e.student_id and la.academic_year_id=e.academic_year_id and la.league_id=p_league))
  group by s.id
 ), ranked as (select scores.*,rank() over(order by stars desc) rank from scores)
 select coalesce(jsonb_agg(to_jsonb(page)),'[]'::jsonb) into result from (
  select ranked.*,count(*) over() total_count from ranked
  where strpos(lower(full_name),lower(p_search))>0 or strpos(lower(admission_number),lower(p_search))>0
  order by case when p_desc then stars end desc,case when not p_desc then stars end asc,full_name,id
  limit least(100,greatest(1,p_limit)) offset greatest(0,p_offset)
 ) page;
 return result;
end $$;
revoke all on function public.individual_rankings(uuid,date,date,text,integer,boolean,integer,boolean,uuid) from public,anon;
grant execute on function public.individual_rankings(uuid,date,date,text,integer,boolean,integer,boolean,uuid) to authenticated;
