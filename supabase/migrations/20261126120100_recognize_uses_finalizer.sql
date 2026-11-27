-- Achievements and the Recognition refresh call private.recognize(). It must use
-- the shared finalizer so periods ending today are included (previously it kept
-- its own end_date<today loop).
create or replace function private.recognize() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'Staff access required'; end if;
 perform private.finalize_due_periods(auth.uid());
end $$;
