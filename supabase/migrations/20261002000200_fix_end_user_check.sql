-- Fix: is_end_user_request() checked current_user, but inside SECURITY DEFINER functions
-- (our guard triggers) current_user is the function owner, so the check always said
-- "not an end user" and the Admin-only guards were skipped. Use the request's JWT role
-- instead, which stays the same inside definer functions.
--   authenticated / anon  -> a signed-in staff member or a visitor (guards apply)
--   service_role          -> our server with the secret key (trusted)
--   no JWT                -> migrations, cron jobs, the SQL editor (trusted)
create or replace function public.is_end_user_request() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon')
$$;
