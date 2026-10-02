-- Tidy-ups from Supabase's security and performance advisors.

-- 1. Pin search_path on every function (stops a function picking up a look-alike object).
alter function public.is_end_user_request() set search_path = public, extensions;
alter function public.set_updated_at() set search_path = public, extensions;
alter function public.audit_log_is_append_only() set search_path = public, extensions;
alter function public.global_search(text, int) set search_path = public, extensions;
alter function public.find_contact_duplicates(text, text, text, text, uuid) set search_path = public, extensions;
alter function public.can_see_subject(text, uuid) set search_path = public, extensions;
alter function public.normalise_au_phone(text) set search_path = public, extensions;

-- 2. Trigger functions only run as triggers; nobody needs to call them through the API.
revoke execute on function public.audit_row_change() from authenticated, anon, public;
revoke execute on function public.guard_profile_update() from authenticated, anon, public;
revoke execute on function public.guard_soft_delete() from authenticated, anon, public;
revoke execute on function public.handle_new_user() from authenticated, anon, public;
revoke execute on function public.set_updated_at() from authenticated, anon, public;
revoke execute on function public.audit_log_is_append_only() from authenticated, anon, public;
-- (has_role, is_staff, current_app_role and support_can_access_contact stay callable:
--  the permission rules call them as the signed-in user, and they only reveal your own role.)

-- 3. Evaluate auth.uid() once per query instead of once per row.
drop policy "edit own profile or admin" on public.profiles;
create policy "edit own profile or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.has_role('admin'))
  with check (id = (select auth.uid()) or public.has_role('admin'));

drop policy "log activities" on public.activities;
create policy "log activities" on public.activities
  for insert to authenticated
  with check (public.is_staff() and actor_id = (select auth.uid()) and public.can_see_subject(subject_type, subject_id));

-- 4. One SELECT policy per table: split the "manage" policies into insert/update/delete.
drop policy "admins change settings" on public.app_settings;
create policy "admins add settings" on public.app_settings
  for insert to authenticated with check (public.has_role('admin'));
create policy "admins edit settings" on public.app_settings
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admins remove settings" on public.app_settings
  for delete to authenticated using (public.has_role('admin'));

drop policy "manage custom fields" on public.custom_field_definitions;
create policy "add custom fields" on public.custom_field_definitions
  for insert to authenticated with check (public.has_role('admin', 'manager'));
create policy "edit custom fields" on public.custom_field_definitions
  for update to authenticated using (public.has_role('admin', 'manager')) with check (public.has_role('admin', 'manager'));
create policy "remove custom fields" on public.custom_field_definitions
  for delete to authenticated using (public.has_role('admin', 'manager'));
