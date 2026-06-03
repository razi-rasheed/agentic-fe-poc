-- Allow the authenticated role to call tests.authenticate_as and tests.clear_authentication
-- so that RLS-isolation tests can switch users and reset session state within a transaction.
-- The tests schema itself is never exposed via the Data API (no anon/authenticated table grants).
grant usage on schema tests to authenticated;
grant execute on function tests.authenticate_as(text) to authenticated;
grant execute on function tests.clear_authentication() to authenticated;
