-- Disabled / pending members must not pass RLS via is_member / is_owner.
-- Client AuthGate already blocks the UI; this closes the JWT+API gap.
--
-- Both helpers are SECURITY DEFINER and take a user id, and RLS policies
-- call them as the signed-in user, so `authenticated` must keep EXECUTE.
-- The `_user = auth.uid()` guard stops a signed-in user from calling
-- /rest/v1/rpc/is_member with someone else's id to probe their
-- memberships. COALESCE keeps the result false (never NULL) when there is
-- no JWT, because NULL skips plpgsql `IF NOT is_member(...)` checks.
-- Every caller passes auth.uid() (policies) or `_caller := auth.uid()`.
--
-- Amended in place: this version was never recorded in production's
-- schema_migrations. An earlier draft revoked EXECUTE from authenticated,
-- which denies every RLS read with "permission denied for function".
--
-- Rollback (restores production's definitions byte for byte, CRLF bodies
-- included; CREATE OR REPLACE keeps grants):
--   CREATE OR REPLACE FUNCTION public.is_member(_institute uuid, _user uuid)
--    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
--   AS E'\r\n  SELECT EXISTS (\r\n    SELECT 1\r\n    FROM public.institute_members\r\n    WHERE institute_id = _institute\r\n      AND user_id = _user\r\n      AND status = \'active\'\r\n      AND access_enabled = true\r\n  );\r\n';
--   CREATE OR REPLACE FUNCTION public.is_owner(_institute uuid, _user uuid)
--    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
--   AS E'\r\n  SELECT EXISTS (\r\n    SELECT 1\r\n    FROM public.institute_members\r\n    WHERE institute_id = _institute\r\n      AND user_id = _user\r\n      AND role = \'owner\'\r\n      AND status = \'active\'\r\n      AND access_enabled = true\r\n  );\r\n';

CREATE OR REPLACE FUNCTION public.is_member(_institute UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user = auth.uid(), false) AND EXISTS (
    SELECT 1
    FROM public.institute_members
    WHERE institute_id = _institute
      AND user_id = _user
      AND status = 'active'
      AND access_enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_institute UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user = auth.uid(), false) AND EXISTS (
    SELECT 1
    FROM public.institute_members
    WHERE institute_id = _institute
      AND user_id = _user
      AND role = 'owner'
      AND status = 'active'
      AND access_enabled = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner(UUID, UUID) TO authenticated;
