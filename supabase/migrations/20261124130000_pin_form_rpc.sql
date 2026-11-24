-- Pinning is a small, explicit function of its own rather than a branch inside
-- the large private.command() body, so the five-pin rule is readable and can be
-- tested directly. Callers use public.pin_form(activity_id); it returns the slot
-- that was filled, or null when the form was unpinned.
create or replace function private.pin_form(p_activity uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  slot integer;
begin
  if not private.is_staff() then
    raise exception 'Staff access required';
  end if;
  if not exists (select 1 from public.activities a where a.id = p_activity and a.active) then
    raise exception 'Select an active attendance form';
  end if;
  delete from public.pinned_forms p where p.staff_id = uid and p.activity_id = p_activity;
  if found then
    return null;
  end if;
  select v into slot
    from generate_series(1, 5) v
   where not exists (
     select 1 from public.pinned_forms p where p.staff_id = uid and p.position = v
   )
   order by v
   limit 1;
  if slot is null then
    raise exception 'You can pin up to 5 forms. Unpin a form first.';
  end if;
  insert into public.pinned_forms(staff_id, activity_id, position)
  values (uid, p_activity, slot);
  return slot;
end $$;
revoke all on function private.pin_form(uuid) from public;
grant execute on function private.pin_form(uuid) to authenticated;

create or replace function public.pin_form(p_activity uuid) returns integer
language sql security invoker set search_path = '' as $$ select private.pin_form(p_activity); $$;
revoke all on function public.pin_form(uuid) from public, anon;
grant execute on function public.pin_form(uuid) to authenticated;

-- A second, table-level guard: every write path, including the retired
-- pin.toggle action still present in private.command(), obeys the same limit.
create or replace function private.enforce_pin_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.pinned_forms p
       where p.staff_id = new.staff_id and p.position <> new.position) >= 5 then
    raise exception 'You can pin up to 5 forms. Unpin a form first.';
  end if;
  return new;
end $$;
drop trigger if exists pin_limit on public.pinned_forms;
create trigger pin_limit before insert or update on public.pinned_forms
for each row execute function private.enforce_pin_limit();
