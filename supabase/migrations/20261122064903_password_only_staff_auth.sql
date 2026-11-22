-- Choose these two Postgres functions in the hosted Auth Hooks settings.
create function public.staff_password_session(event jsonb) returns jsonb language sql stable set search_path='' as $$
 select case when event->>'authentication_method'='password' or
  (event->>'authentication_method'='token_refresh' and event->'claims'->'amr' @> '[{"method":"password"}]'::jsonb)
 then jsonb_build_object('claims',event->'claims')
 else '{"error":{"http_code":403,"message":"Sign in with your staff email and password."}}'::jsonb end;
$$;
create function public.owner_managed_auth_email(event jsonb) returns jsonb language sql immutable set search_path='' as $$
 select '{"error":{"http_code":403,"message":"Contact the academy owner for account access."}}'::jsonb;
$$;
revoke all on function public.staff_password_session(jsonb),public.owner_managed_auth_email(jsonb) from public,anon,authenticated;
grant execute on function public.staff_password_session(jsonb),public.owner_managed_auth_email(jsonb) to supabase_auth_admin;
