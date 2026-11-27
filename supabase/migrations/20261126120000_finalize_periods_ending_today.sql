-- A period whose end date is today is complete for recognition purposes, so it
-- should be finalized and shown in Achievements on that day rather than waiting
-- for the next day. This replaces the earlier end_date<today rule.
create or replace function private.finalize_due_periods(actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record; today date; begin

 perform pg_advisory_xact_lock(781324);
 select (now() at time zone timezone)::date into today from public.institution_settings where id=1;
 for r in select * from public.recognition_periods where end_date<=today and finalized_at is null order by end_date,category loop
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
