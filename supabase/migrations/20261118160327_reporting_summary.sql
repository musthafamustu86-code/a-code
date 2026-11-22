-- Reporting uses the selected year and inclusive institution dates. No period,
-- enrolment, ledger entry, or recognition result is changed by this function.
create function public.reporting_summary(p_year uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  chosen_year public.academic_years;
begin
  select * into chosen_year from public.academic_years
  where id = p_year and status in ('active', 'closed');
  if not found then
    raise exception 'Choose a confirmed academic year';
  end if;
  if p_start is null or p_end is null or p_start > p_end
     or p_start < chosen_year.start_date or p_end > chosen_year.end_date then
    raise exception 'Choose a date range inside the selected academic year';
  end if;

  return jsonb_build_object(
    'students', (select count(*) from public.enrolments e
      join public.students s on s.id = e.student_id
      where e.academic_year_id = p_year and e.progression not in ('graduated', 'left')
        and (chosen_year.status = 'closed' or s.active)),
    'stars', (select coalesce(sum(t.amount), 0) from public.star_transactions t
      where t.academic_year_id = p_year and t.earned_on between p_start and p_end),
    'attendance', (select round(100.0 * count(*) filter (where r.present) / nullif(count(*), 0), 1)
      from public.attendance_sessions a join public.attendance_records r on r.session_id = a.id
      where a.academic_year_id = p_year and a.attendance_date between p_start and p_end
        and a.status in ('active', 'archived')),
    'recent', (select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at desc, recent.id desc), '[]'::jsonb)
      from (select * from public.star_transactions t where t.academic_year_id = p_year
        and t.earned_on between p_start and p_end order by t.created_at desc, t.id desc limit 5) recent)
  );
end;
$$;

revoke all on function public.reporting_summary(uuid, date, date) from public, anon;
grant execute on function public.reporting_summary(uuid, date, date) to authenticated;
