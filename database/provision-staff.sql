-- Owner workflow only. First create the email/password account in Supabase Auth.
-- Replace these two fictional placeholders before running in Supabase SQL Editor.
-- No password or service-role key is stored in this repository.
insert into public.staff_profiles(id,display_name,active)
select id,'Staff display name',true from auth.users where email='staff@example.invalid'
on conflict(id) do update set display_name=excluded.display_name,active=true;
-- A zero-row result means that the matching Auth user has not been created yet.
