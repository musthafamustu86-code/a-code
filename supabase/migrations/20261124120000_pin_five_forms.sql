-- Each staff member may pin up to five attendance forms (was eight).
delete from public.pinned_forms where position > 5;
alter table public.pinned_forms drop constraint if exists pinned_forms_position_check;
alter table public.pinned_forms add constraint pinned_forms_position_check check(position between 1 and 5);

-- Keep the pin command in step with the new limit without rewriting the whole
-- command body: replace the pin slot range and the error message in place.
do $$
declare src text;
begin
  select p.prosrc into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'command';
  if src is null then raise exception 'private.command() is missing'; end if;
  if position('generate_series(1,8)' in src) = 0 then
    raise exception 'Pin range not found in private.command(); review the function manually';
  end if;
  src := replace(src, 'generate_series(1,8)', 'generate_series(1,5)');
  src := replace(src, 'You can pin up to 8 forms. Unpin a form first.', 'You can pin up to 5 forms. Unpin a form first.');
  execute 'create or replace function private.command(p_action text, p jsonb) returns jsonb language plpgsql security definer set search_path = '''' as $body$' || src || '$body$';
end $$;
