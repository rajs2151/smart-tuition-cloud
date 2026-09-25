-- is_owner_or_admin(_institute, _user) is SECURITY DEFINER and takes an
-- arbitrary user id, and 20260714120001 left the default PUBLIC grant in
-- place, so anon could call /rest/v1/rpc/is_owner_or_admin to probe whether
-- any user is an owner/admin of any institute. Nothing calls it as anon
-- (it is not referenced by any policy, RPC or client code).
--
-- Only PUBLIC and anon lose EXECUTE; the postgres, service_role and
-- authenticated grants are kept. Safe to re-run: REVOKE on a grant that is
-- already absent is a no-op, so this can be applied by hand first.
--
-- Rollback (restores the production ACL
-- {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,...}):
--   GRANT EXECUTE ON FUNCTION public.is_owner_or_admin(uuid, uuid) TO PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.is_owner_or_admin(uuid, uuid) FROM PUBLIC, anon;
