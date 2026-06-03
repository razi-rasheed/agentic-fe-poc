begin;
select plan(7);

-- structure
select has_table('public', 'athletes', 'athletes table exists');
select col_is_pk('public', 'athletes', 'id', 'athletes.id is PK');
select hasnt_column('public', 'athletes', 'intervals_api_key', 'no plaintext Intervals secret column (spec §6.4)');
select has_column('public', 'athletes', 'timezone', 'athletes has timezone');

-- provisioning trigger: creating an auth user auto-creates an athletes row
select tests.create_supabase_user('alice');
select is(
  (select count(*) from public.athletes where id = tests.get_supabase_uid('alice')),
  1::bigint,
  'auth user insert provisions an athletes row'
);

-- RLS isolation
select tests.create_supabase_user('bob');
select tests.authenticate_as('alice');
select is((select count(*) from public.athletes), 1::bigint, 'alice sees only her own athlete row');
select tests.clear_authentication();

select tests.authenticate_as('bob');
select is((select count(*) from public.athletes), 1::bigint, 'bob sees only his own athlete row');
select tests.clear_authentication();

select * from finish();
rollback;
