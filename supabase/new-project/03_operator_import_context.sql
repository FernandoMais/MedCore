-- OPERATOR ONLY, TARGET ONLY, inside psql --single-transaction.
-- Use immediately before a reviewed DATA-ONLY import, never through an app RPC.
-- No roles, grants, triggers, RLS policies or Auth bindings are changed here.
do $$
begin
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'This import requires a trusted database operator session.';
  end if;
end
$$;

set local request.jwt.claims = '{"role":"service_role"}';
set local request.jwt.claim.role = 'service_role';

do $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Import authorization is missing. Run inside --single-transaction.';
  end if;
end
$$;