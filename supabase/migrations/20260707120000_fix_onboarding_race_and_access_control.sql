-- =========================================================
-- Fix: onboarding screen re-appearing after institute creation
-- =========================================================
-- Root cause (DB layer): migration 20260707084455 added a SECOND trigger
-- (trg_add_creator_as_owner) that duplicates the ORIGINAL trigger
-- (on_institute_created) from 20260703064918. Both call the same
-- add_creator_as_owner() function on every institute insert. This was a
-- misdiagnosis of the real bug (which was a client-side race — see the
-- session.ts changes in this same fix) and left two triggers doing the
-- same job. It didn't cause data corruption (ON CONFLICT DO NOTHING
-- protected it) but it's redundant and confusing, so we remove the
-- duplicate and keep a single, clearly-named trigger.
DROP TRIGGER IF EXISTS trg_add_creator_as_owner ON public.institutes;
DROP TRIGGER IF EXISTS on_institute_created ON public.institutes;

CREATE TRIGGER trg_institute_created_add_owner
  AFTER INSERT ON public.institutes
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_owner();

-- =========================================================
-- Per-member access control (Case 2 in the desired flow)
-- =========================================================
-- Distinct from institutes.subscription_status (which gates the whole
-- institute, e.g. trial expired). access_enabled gates a single member
-- (e.g. an owner disabling a staff account, or an admin disabling an
-- abusive owner) without touching the institute itself.
ALTER TABLE public.institute_members
  ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN NOT NULL DEFAULT true;

-- =========================================================
-- Prevent duplicate/orphan institute creation at the data layer
-- =========================================================
-- Even with a client-side idempotency check, two concurrent requests
-- (double-click, retry-after-timeout, two open tabs) can both pass a
-- "do I already have a membership?" check before either insert commits.
-- A unique index is the only thing that actually guarantees correctness
-- under concurrency. One user can own at most one institute.
CREATE UNIQUE INDEX IF NOT EXISTS institute_members_one_owner_per_user
  ON public.institute_members (user_id)
  WHERE role = 'owner';

-- =========================================================
-- Atomic "create institute + owner membership" RPC
-- =========================================================
-- Replaces the client doing: SELECT (check existing) -> INSERT institutes
-- -> (trigger inserts institute_members) as three separate round trips
-- with real TOCTOU gaps. This RPC is idempotent: if the caller already
-- owns an institute, it returns that institute instead of erroring or
-- creating a duplicate. If a genuine race slips through (two calls at
-- the exact same instant), the unique index above rejects the second
-- one with a 23505 error, which the client treats as "already exists,
-- just refresh" rather than a hard failure.
CREATE OR REPLACE FUNCTION public.create_institute_with_owner(
  _name TEXT,
  _phone TEXT,
  _address TEXT,
  _email TEXT
) RETURNS public.institutes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _institute public.institutes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'institute name is required';
  END IF;

  -- Idempotency fast-path: caller already owns an institute.
  SELECT i.* INTO _institute
  FROM public.institutes i
  JOIN public.institute_members m ON m.institute_id = i.id
  WHERE m.user_id = auth.uid() AND m.role = 'owner'
  LIMIT 1;

  IF FOUND THEN
    RETURN _institute;
  END IF;

  INSERT INTO public.institutes (name, phone, address, email, created_by)
  VALUES (btrim(_name), coalesce(btrim(_phone), ''), coalesce(btrim(_address), ''), coalesce(btrim(_email), ''), auth.uid())
  RETURNING * INTO _institute;
  -- trg_institute_created_add_owner fires here, inside this same
  -- transaction, and inserts the owner membership row. By the time this
  -- function returns, the membership is guaranteed to exist and be
  -- visible to the caller's next SELECT.

  RETURN _institute;
END;
$$;

REVOKE ALL ON FUNCTION public.create_institute_with_owner(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_institute_with_owner(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Institute creation now happens exclusively through the RPC above,
-- which runs SECURITY DEFINER as the function owner. Direct client-side
-- INSERTs into institutes are no longer needed for onboarding; the
-- existing "Signed-in users can create an institute" policy is left in
-- place for now since it isn't harmful (WITH CHECK still forces
-- created_by = auth.uid()), but the app no longer relies on it for the
-- onboarding path.
