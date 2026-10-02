-- Waypoint Hub, Phase 1: foundation
-- Staff profiles and roles, invitations, contacts, organisations, tags, custom fields,
-- the activity timeline, the audit log and app settings. Row Level Security on everything.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_cron;

-- Nobody signed out can read anything. Public pages (referral form etc.) go through the server.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'manager', 'bizdev', 'support');

create type public.organisation_type as enum (
  'support_coordination', 'plan_management', 'lac', 'carer_org',
  'allied_health', 'community_group', 'government', 'other'
);

create type public.activity_type as enum (
  'call', 'email', 'sms', 'note', 'meeting', 'stage_change', 'referral', 'event', 'system'
);

create type public.audit_action as enum (
  'view', 'create', 'update', 'delete', 'restore', 'hard_delete',
  'export', 'import', 'merge', 'login', 'invite', 'role_change'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Australian phone numbers to a comparable form: digits only, +61 / 61 -> 0.
create function public.normalise_au_phone(p text) returns text
language sql immutable parallel safe as $$
  select nullif(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^61', '0'), '')
$$;

-- True when the request comes from a signed-in staff member (not the server's service role).
create function public.is_end_user_request() returns boolean
language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- ---------------------------------------------------------------------------
-- Staff profiles and invitations
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null unique,
  full_name text not null default '',
  preferred_name text,
  role public.app_role not null default 'support',
  phone text,
  avatar_url text,
  mfa_required boolean not null default false,
  notification_prefs jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  full_name text,
  role public.app_role not null default 'support',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz
);
create unique index invitations_one_pending_per_email
  on public.invitations (email) where accepted_at is null and revoked_at is null;

-- Role helpers. SECURITY DEFINER so policies can call them without recursive RLS.
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public, extensions as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(public.current_app_role() = any (roles), false)
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.current_app_role() is not null
$$;

-- Auth hook: only invited people can create an account (covers magic link AND Google).
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(event -> 'user' ->> 'email');
begin
  if exists (
    select 1 from public.invitations
    where lower(email::text) = v_email and accepted_at is null and revoked_at is null and expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Waypoint Hub is invite-only. Ask an Admin to send you an invitation.'
  ));
end $$;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- New auth user -> staff profile, using the role from their invitation.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invite public.invitations;
begin
  select * into v_invite from public.invitations
  where lower(email::text) = lower(new.email) and accepted_at is null and revoked_at is null
  order by created_at desc limit 1;

  insert into public.profiles (id, email, full_name, role, mfa_required)
  values (
    new.id,
    lower(new.email),
    coalesce(v_invite.full_name, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(v_invite.role, 'support'),
    coalesce(v_invite.role, 'support') = 'admin'
  );

  if v_invite.id is not null then
    update public.invitations set accepted_at = now() where id = v_invite.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only Admins may change someone's role, active status or 2FA requirement,
-- and the last active Admin can't be removed.
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.is_end_user_request() and not public.has_role('admin') then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.mfa_required is distinct from old.mfa_required
       or new.email is distinct from old.email then
      raise exception 'Only an Admin can change roles, access or two-factor settings.'
        using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active) then
    if (select count(*) from public.profiles where role = 'admin' and active and id <> old.id) = 0 then
      raise exception 'You need at least one active Admin.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Organisations and contacts
-- ---------------------------------------------------------------------------
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type public.organisation_type not null default 'other',
  abn text,
  phone text,
  email extensions.citext,
  website text,
  address_line text,
  suburb text,
  state text default 'QLD',
  postcode text,
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  search_text text generated always as (lower(coalesce(name, '') || ' ' || coalesce(suburb, '') || ' ' || coalesce(email::text, ''))) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);
create index organisations_search_trgm on public.organisations using gin (search_text extensions.gin_trgm_ops);
create index organisations_live on public.organisations (name) where deleted_at is null;
create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null default '',
  preferred_name text,
  email extensions.citext,
  phone text,
  mobile text,
  address_line text,
  suburb text,
  state text default 'QLD',
  postcode text,
  organisation_id uuid references public.organisations (id) on delete set null,
  job_title text,
  notes text,
  do_not_contact boolean not null default false,
  email_opt_out boolean not null default false,
  sms_opt_out boolean not null default false,
  custom_fields jsonb not null default '{}'::jsonb,
  phone_norm text generated always as (public.normalise_au_phone(phone)) stored,
  mobile_norm text generated always as (public.normalise_au_phone(mobile)) stored,
  search_text text generated always as (lower(
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(preferred_name, '') || ' ' ||
    coalesce(email::text, '') || ' ' || coalesce(suburb, '') || ' ' || coalesce(mobile, '') || ' ' || coalesce(phone, '')
  )) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);
create index contacts_search_trgm on public.contacts using gin (search_text extensions.gin_trgm_ops);
create index contacts_email on public.contacts (email) where deleted_at is null;
create index contacts_mobile_norm on public.contacts (mobile_norm) where deleted_at is null;
create index contacts_phone_norm on public.contacts (phone_norm) where deleted_at is null;
create index contacts_org on public.contacts (organisation_id);
create index contacts_live on public.contacts (last_name, first_name) where deleted_at is null;
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Only Admins and Managers can bin or restore records; stamps who did it.
create function public.guard_soft_delete() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if public.is_end_user_request() and not public.has_role('admin', 'manager') then
      raise exception 'Only an Admin or Manager can delete or restore records.' using errcode = '42501';
    end if;
    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;
  return new;
end $$;
create trigger organisations_soft_delete before update on public.organisations
  for each row execute function public.guard_soft_delete();
create trigger contacts_soft_delete before update on public.contacts
  for each row execute function public.guard_soft_delete();

-- Support Staff see contacts linked to leads assigned to them. Leads arrive in Phase 2,
-- which replaces this function; for now Support Staff see no contacts.
create function public.support_can_access_contact(p_contact_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select false
$$;

-- ---------------------------------------------------------------------------
-- Tags and custom fields
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null unique check (length(trim(name::text)) > 0),
  colour text not null default 'teal',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.contact_tags (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (contact_id, tag_id)
);
create index contact_tags_tag on public.contact_tags (tag_id);

create table public.organisation_tags (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (organisation_id, tag_id)
);
create index organisation_tags_tag on public.organisation_tags (tag_id);

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('contact', 'organisation', 'lead')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'select', 'checkbox')),
  options text[] not null default '{}',
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entity, key)
);

-- ---------------------------------------------------------------------------
-- Activity timeline
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('contact', 'organisation', 'lead', 'referral', 'event')),
  subject_id uuid not null,
  type public.activity_type not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid default auth.uid() references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index activities_subject on public.activities (subject_type, subject_id, occurred_at desc);

-- Can the current user see the record an activity belongs to? (Uses the caller's RLS.)
create function public.can_see_subject(p_type text, p_id uuid) returns boolean
language sql stable as $$
  select case p_type
    when 'contact' then exists (select 1 from public.contacts where id = p_id)
    when 'organisation' then exists (select 1 from public.organisations where id = p_id)
    else public.has_role('admin', 'manager', 'bizdev')
  end
$$;

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid,
  changed_fields text[] not null default '{}',
  details jsonb not null default '{}'::jsonb
);
create index audit_log_entity on public.audit_log (entity_type, entity_id, at desc);
create index audit_log_actor on public.audit_log (actor_id, at desc);

create function public.audit_log_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'The audit log can''t be changed or deleted.' using errcode = '42501';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

-- Write an audit entry as the current user. Callable from the app for views and exports.
-- Never pass personal details in p_details; names of fields only.
create function public.write_audit(
  p_action public.audit_action,
  p_entity_type text,
  p_entity_id uuid default null,
  p_changed_fields text[] default '{}',
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.is_end_user_request() and not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, changed_fields, details)
  values (
    auth.uid(),
    (select email::text from public.profiles where id = auth.uid()),
    p_action, p_entity_type, p_entity_id, coalesce(p_changed_fields, '{}'), coalesce(p_details, '{}'::jsonb)
  );
end $$;
revoke execute on function public.write_audit(public.audit_action, text, uuid, text[], jsonb) from public, anon;
grant execute on function public.write_audit(public.audit_action, text, uuid, text[], jsonb) to authenticated;

-- Generic row-change audit trigger. Records which fields changed, not their values.
create function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_changed text[];
  v_action public.audit_action;
  v_id uuid := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
begin
  select coalesce(array_agg(k order by k), '{}') into v_changed
  from jsonb_object_keys(v_old || v_new) as k
  where k not in ('updated_at', 'search_text', 'phone_norm', 'mobile_norm', 'last_seen_at')
    and (v_old -> k) is distinct from (v_new -> k);

  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif tg_op = 'DELETE' then
    v_action := 'hard_delete';
  elsif (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
    v_action := 'delete';
  elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
    v_action := 'restore';
  elsif tg_table_name = 'profiles' and (v_old ->> 'role') is distinct from (v_new ->> 'role') then
    v_action := 'role_change';
  else
    if coalesce(array_length(v_changed, 1), 0) = 0 then
      return null;
    end if;
    v_action := 'update';
  end if;

  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, changed_fields, details)
  values (
    auth.uid(),
    (select email::text from public.profiles where id = auth.uid()),
    v_action,
    tg_table_name,
    v_id,
    case when tg_op = 'UPDATE' then v_changed else '{}' end,
    case when v_action = 'role_change'
      then jsonb_build_object('from', v_old ->> 'role', 'to', v_new ->> 'role')
      else '{}'::jsonb end
  );
  return null;
end $$;

create trigger contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.audit_row_change();
create trigger organisations_audit after insert or update or delete on public.organisations
  for each row execute function public.audit_row_change();
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- App settings
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null
);
insert into public.app_settings (key, value) values
  ('idle_timeout_minutes', '30'),
  ('timezone', '"Australia/Brisbane"');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.organisations enable row level security;
alter table public.contacts enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.organisation_tags enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.activities enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;

-- Profiles: the whole team can see each other; you edit yourself, Admins edit anyone.
create policy "staff read profiles" on public.profiles
  for select to authenticated using (public.is_staff());
create policy "edit own profile or admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

-- Invitations: Admins only.
create policy "admins manage invitations" on public.invitations
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Organisations: Admin, Manager, Business Development. Binned records only for Admin/Manager.
create policy "read organisations" on public.organisations
  for select to authenticated
  using (public.has_role('admin', 'manager', 'bizdev') and (deleted_at is null or public.has_role('admin', 'manager')));
create policy "add organisations" on public.organisations
  for insert to authenticated with check (public.has_role('admin', 'manager', 'bizdev'));
create policy "edit organisations" on public.organisations
  for update to authenticated
  using (public.has_role('admin', 'manager', 'bizdev'))
  with check (public.has_role('admin', 'manager', 'bizdev'));
create policy "hard delete organisations" on public.organisations
  for delete to authenticated using (public.has_role('admin'));

-- Contacts: as above, plus Support Staff for contacts on their assigned leads (Phase 2).
create policy "read contacts" on public.contacts
  for select to authenticated
  using (
    (public.has_role('admin', 'manager', 'bizdev') and (deleted_at is null or public.has_role('admin', 'manager')))
    or (deleted_at is null and public.has_role('support') and public.support_can_access_contact(id))
  );
create policy "add contacts" on public.contacts
  for insert to authenticated with check (public.has_role('admin', 'manager', 'bizdev'));
create policy "edit contacts" on public.contacts
  for update to authenticated
  using (public.has_role('admin', 'manager', 'bizdev') or (public.has_role('support') and public.support_can_access_contact(id)))
  with check (public.has_role('admin', 'manager', 'bizdev') or (public.has_role('support') and public.support_can_access_contact(id)));
create policy "hard delete contacts" on public.contacts
  for delete to authenticated using (public.has_role('admin'));

-- Tags: everyone can see; Admin/Manager/BD can create; Admin/Manager can rename or remove.
create policy "staff read tags" on public.tags for select to authenticated using (public.is_staff());
create policy "add tags" on public.tags for insert to authenticated with check (public.has_role('admin', 'manager', 'bizdev'));
create policy "edit tags" on public.tags for update to authenticated
  using (public.has_role('admin', 'manager')) with check (public.has_role('admin', 'manager'));
create policy "remove tags" on public.tags for delete to authenticated using (public.has_role('admin', 'manager'));

create policy "read contact tags" on public.contact_tags for select to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "tag contacts" on public.contact_tags for insert to authenticated
  with check (public.has_role('admin', 'manager', 'bizdev'));
create policy "untag contacts" on public.contact_tags for delete to authenticated
  using (public.has_role('admin', 'manager', 'bizdev'));

create policy "read organisation tags" on public.organisation_tags for select to authenticated
  using (exists (select 1 from public.organisations o where o.id = organisation_id));
create policy "tag organisations" on public.organisation_tags for insert to authenticated
  with check (public.has_role('admin', 'manager', 'bizdev'));
create policy "untag organisations" on public.organisation_tags for delete to authenticated
  using (public.has_role('admin', 'manager', 'bizdev'));

-- Custom fields: everyone reads the definitions, Admin/Manager manage them.
create policy "staff read custom fields" on public.custom_field_definitions
  for select to authenticated using (public.is_staff());
create policy "manage custom fields" on public.custom_field_definitions
  for all to authenticated
  using (public.has_role('admin', 'manager')) with check (public.has_role('admin', 'manager'));

-- Activities: visible if you can see the record; you log as yourself; only Admins edit history.
create policy "read activities" on public.activities
  for select to authenticated using (public.is_staff() and public.can_see_subject(subject_type, subject_id));
create policy "log activities" on public.activities
  for insert to authenticated
  with check (public.is_staff() and actor_id = auth.uid() and public.can_see_subject(subject_type, subject_id));
create policy "admins edit activities" on public.activities
  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admins delete activities" on public.activities
  for delete to authenticated using (public.has_role('admin'));

-- Audit log: Admins read. Nobody writes directly (triggers and write_audit only).
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (public.has_role('admin'));

-- Settings: everyone reads, Admins change.
create policy "staff read settings" on public.app_settings
  for select to authenticated using (public.is_staff());
create policy "admins change settings" on public.app_settings
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------------------------------------------------------------------
-- Search, duplicates and merge
-- ---------------------------------------------------------------------------

-- Global search for the Ctrl+K bar. Runs as the caller, so RLS decides what comes back.
create function public.global_search(q text, max_results int default 8)
returns table (kind text, id uuid, title text, subtitle text, score real)
language sql stable as $$
  with term as (select lower(trim(q)) as t)
  (
    select 'contact'::text, c.id,
      trim(c.first_name || ' ' || c.last_name || coalesce(' (' || c.preferred_name || ')', '')),
      coalesce(o.name, c.email::text, c.mobile, c.suburb, ''),
      extensions.similarity(c.search_text, term.t)
    from public.contacts c
    cross join term
    left join public.organisations o on o.id = c.organisation_id
    where c.deleted_at is null and length(term.t) > 0 and c.search_text like '%' || term.t || '%'
    order by 5 desc, 3
    limit max_results
  )
  union all
  (
    select 'organisation'::text, o.id, o.name,
      coalesce(replace(initcap(o.type::text), '_', ' '), '') || coalesce(' · ' || o.suburb, ''),
      extensions.similarity(o.search_text, term.t)
    from public.organisations o
    cross join term
    where o.deleted_at is null and length(term.t) > 0 and o.search_text like '%' || term.t || '%'
    order by 5 desc, 3
    limit max_results
  )
$$;

-- Possible duplicates for a new or existing contact: same email, same phone, or same name.
create function public.find_contact_duplicates(
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_phone text default null,
  p_exclude uuid default null
) returns table (id uuid, first_name text, last_name text, email text, mobile text, reason text)
language sql stable as $$
  select c.id, c.first_name, c.last_name, c.email::text, coalesce(c.mobile, c.phone),
    case
      when p_email is not null and c.email = p_email::extensions.citext then 'Same email'
      when public.normalise_au_phone(p_phone) is not null
        and public.normalise_au_phone(p_phone) in (c.mobile_norm, c.phone_norm) then 'Same phone number'
      else 'Same name'
    end
  from public.contacts c
  where c.deleted_at is null
    and (p_exclude is null or c.id <> p_exclude)
    and (
      (p_email is not null and length(trim(p_email)) > 0 and c.email = p_email::extensions.citext)
      or (public.normalise_au_phone(p_phone) is not null
          and public.normalise_au_phone(p_phone) in (c.mobile_norm, c.phone_norm))
      or (lower(trim(c.first_name)) = lower(trim(p_first_name))
          and lower(trim(c.last_name)) = lower(trim(coalesce(p_last_name, '')))
          and length(trim(coalesce(p_last_name, ''))) > 0)
    )
  limit 10
$$;

-- Merge p_merge into p_keep: fills gaps, moves tags and history, bins the duplicate.
create function public.merge_contacts(p_keep uuid, p_merge uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  k public.contacts;
  m public.contacts;
begin
  if not public.has_role('admin', 'manager') then
    raise exception 'Only an Admin or Manager can merge contacts.' using errcode = '42501';
  end if;
  if p_keep = p_merge then
    raise exception 'Pick two different contacts to merge.';
  end if;

  select * into k from public.contacts where id = p_keep and deleted_at is null for update;
  select * into m from public.contacts where id = p_merge and deleted_at is null for update;
  if k.id is null or m.id is null then
    raise exception 'One of those contacts no longer exists.';
  end if;

  update public.contacts set
    preferred_name = coalesce(k.preferred_name, m.preferred_name),
    last_name = case when k.last_name = '' then m.last_name else k.last_name end,
    email = coalesce(k.email, m.email),
    phone = coalesce(k.phone, m.phone),
    mobile = coalesce(k.mobile, m.mobile),
    address_line = coalesce(k.address_line, m.address_line),
    suburb = coalesce(k.suburb, m.suburb),
    postcode = coalesce(k.postcode, m.postcode),
    organisation_id = coalesce(k.organisation_id, m.organisation_id),
    job_title = coalesce(k.job_title, m.job_title),
    notes = nullif(concat_ws(E'\n\n', k.notes, m.notes), ''),
    -- Opt-outs always win: if either record said no, the merged one says no.
    do_not_contact = k.do_not_contact or m.do_not_contact,
    email_opt_out = k.email_opt_out or m.email_opt_out,
    sms_opt_out = k.sms_opt_out or m.sms_opt_out,
    custom_fields = m.custom_fields || k.custom_fields
  where id = p_keep;

  insert into public.contact_tags (contact_id, tag_id)
    select p_keep, tag_id from public.contact_tags where contact_id = p_merge
    on conflict do nothing;

  update public.activities set subject_id = p_keep
    where subject_type = 'contact' and subject_id = p_merge;

  update public.contacts set deleted_at = now(), deleted_by = auth.uid(),
    notes = concat_ws(E'\n\n', notes, 'Merged into another contact on ' || to_char(now() at time zone 'Australia/Brisbane', 'DD/MM/YYYY'))
    where id = p_merge;

  insert into public.activities (subject_type, subject_id, type, body, actor_id, metadata)
    values ('contact', p_keep, 'system', 'Merged a duplicate record into this contact', auth.uid(),
            jsonb_build_object('merged_contact_id', p_merge));

  perform public.write_audit('merge', 'contacts', p_keep, '{}', jsonb_build_object('merged_contact_id', p_merge));
end $$;
revoke execute on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 30-day recycle bin: permanently remove records binned more than 30 days ago.
-- ---------------------------------------------------------------------------
create function public.purge_binned_records() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.contacts where deleted_at < now() - interval '30 days';
  delete from public.organisations where deleted_at < now() - interval '30 days';
end $$;
revoke execute on function public.purge_binned_records() from public, anon, authenticated;

-- 3am Brisbane time (17:00 UTC) every day.
select cron.schedule('purge-binned-records', '0 17 * * *', $$select public.purge_binned_records()$$);

-- Tighten access: nothing in this schema is reachable while signed out.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.purge_binned_records() from authenticated;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
