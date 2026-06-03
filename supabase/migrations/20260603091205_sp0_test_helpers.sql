-- pgTAP + test-only auth simulation helpers (tests schema is not exposed via the API)
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

-- Create a fake Supabase auth user and return its id.
create or replace function tests.create_supabase_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    identifier || '@test.local',
    json_build_object('identifier', identifier, 'display_name', identifier),
    now(), now()
  );
  return uid;
end;
$$;

-- Look up a previously-created test user's id.
create or replace function tests.get_supabase_uid(identifier text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id from auth.users where email = identifier || '@test.local' limit 1;
$$;

-- Switch the current session to act as the given user under the authenticated role.
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
as $$
declare
  uid uuid := tests.get_supabase_uid(identifier);
begin
  if uid is null then
    raise exception 'No test user with identifier %', identifier;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated', 'email', identifier || '@test.local')::text,
    true
  );
end;
$$;

-- Drop back to the privileged session role (bypasses RLS) for test setup.
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;
