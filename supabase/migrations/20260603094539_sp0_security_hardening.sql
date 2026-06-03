-- Security hardening from `get_advisors` (security) after the SP0 schema landed.

-- handle_new_user is a trigger function only; it must NOT be a callable PostgREST RPC.
-- Postgres grants EXECUTE to PUBLIC by default, exposing it via /rest/v1/rpc. Revoke it.
-- (Trigger invocation does not check EXECUTE, so the on_auth_user_created trigger keeps working.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Pin search_path on the test-helper functions (advisor: function_search_path_mutable).
-- Bodies use only fully-qualified (tests.*) or pg_catalog objects, so '' is safe.
alter function tests.authenticate_as(text) set search_path = '';
alter function tests.clear_authentication() set search_path = '';
