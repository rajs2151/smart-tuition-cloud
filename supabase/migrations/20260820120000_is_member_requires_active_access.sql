-- Disabled / pending members must not pass RLS via is_member / is_owner.
-- Client AuthGate already blocks the UI; this closes the JWT+API gap.

CREATE OR REPLACE FUNCTION public.is_member(_institute UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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
  SELECT EXISTS (
    SELECT 1
    FROM public.institute_members
    WHERE institute_id = _institute
      AND user_id = _user
      AND role = 'owner'
      AND status = 'active'
      AND access_enabled = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
-- SECURITY DEFINER helpers are invoked from RLS policies as the table owner;
-- no EXECUTE grant to authenticated/anon is required (same pattern as earlier migrations).
