-- Migration 20260703064947 revoked EXECUTE on is_member/is_owner from
-- PUBLIC, anon, AND authenticated — but never re-granted it to
-- authenticated. Both functions are called from inside RLS policies on
-- every tenant-scoped table (institutes, institute_members, batches,
-- students, payments, receipts, audit_logs), and PostgREST executes as the
-- `authenticated` role for every real signed-in user. Without EXECUTE,
-- every RLS-protected query for a real user fails with
-- "permission denied for function is_member" — including the very first
-- membership lookup the app performs right after sign-in. This has been
-- broken since that migration; found and confirmed by directly simulating
-- an authenticated request against the database during the Supabase
-- project cutover (see CUTOVER.md).
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid, uuid) TO authenticated;

-- Tightening: next_receipt_number ended up granted to PUBLIC (and
-- therefore anon) with no restriction, flagged by Supabase's security
-- advisor. It's only ever meant to be called by a signed-in member
-- recording a payment for their own institute; anon has no legitimate
-- reason to call it at all.
REVOKE EXECUTE ON FUNCTION public.next_receipt_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(uuid) TO authenticated;
