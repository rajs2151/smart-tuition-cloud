-- Adds notified_at to attendance_absences so the Notify list (Reports →
-- batch → day → absentees) can show per-student sent/pending state that
-- survives a refresh and is consistent across devices — this can't live
-- in client-side React state alone, since "sent" needs to persist.
-- Kept as its own migration rather than editing
-- 20260730052621_attendance_system.sql, which has already been reviewed
-- and approved as-is.

ALTER TABLE public.attendance_absences
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- No RLS/grant changes needed: attendance_absences' existing UPDATE
-- policy (scoped via the parent session's institute_id) already covers
-- writes to this new column — it's just one more field on a row members
-- can already update.
