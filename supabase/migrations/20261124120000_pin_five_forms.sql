-- Each staff member may pin up to five attendance forms (was eight).
-- The pin command itself lives in 20261124130000_pin_form_rpc.sql.
delete from public.pinned_forms where position > 5;
alter table public.pinned_forms drop constraint if exists pinned_forms_position_check;
alter table public.pinned_forms add constraint pinned_forms_position_check check(position between 1 and 5);
