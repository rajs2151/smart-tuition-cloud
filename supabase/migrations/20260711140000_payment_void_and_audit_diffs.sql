-- =========================================================
-- Controlled editing for Students & Payments
--
-- 1. Payments gain a genuine "voided" status, distinct from the existing
--    soft-delete (`deleted`) column. Soft-delete moves a record to the
--    Recycle Bin (hidden from normal views, restorable/purgeable there).
--    Voiding is different: a voided payment must stay visible in the
--    regular payment history and stay searchable, it just stops counting
--    towards collected/outstanding totals. Reusing `deleted` for this
--    would have hidden voided payments from the exact place they need to
--    remain visible, so it needs its own column.
--
-- 2. audit_logs gains structured old_value/new_value snapshots (JSONB) so
--    "Student Edited" / "Payment Edited" / "Payment Voided" entries can
--    show exactly what changed, not just a one-line text summary.
--
-- 3. students gains date_of_birth: the edit dialog now exposes every
--    field the Edit Student spec lists, including Date of Birth, which
--    this schema never had a column for.
-- =========================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
