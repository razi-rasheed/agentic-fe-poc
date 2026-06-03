begin;
select plan(2);

select has_extension('pgtap');
select isnt(tests.create_supabase_user('harness_check'), null, 'create_supabase_user returns a uuid');

select * from finish();
rollback;
