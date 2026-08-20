-- Persist the Dashboard "Needs follow-up" % threshold per institute.
-- Additive column only. Default 40 matches the previous client-side useState.
-- No UPDATE of existing student/payment rows.

ALTER TABLE public.institutes
  ADD COLUMN IF NOT EXISTS follow_up_threshold SMALLINT NOT NULL DEFAULT 40;

ALTER TABLE public.institutes
  DROP CONSTRAINT IF EXISTS institutes_follow_up_threshold_check;

ALTER TABLE public.institutes
  ADD CONSTRAINT institutes_follow_up_threshold_check
  CHECK (follow_up_threshold IN (20, 30, 40, 50, 60));
