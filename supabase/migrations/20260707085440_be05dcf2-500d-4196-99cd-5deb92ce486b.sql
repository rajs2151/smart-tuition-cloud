ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE public.institutes DROP CONSTRAINT IF EXISTS institutes_subscription_status_check;
-- No CHECK constraint per guidance; validated in app. Backfill existing rows to 'trial'.
UPDATE public.institutes SET subscription_status = 'trial' WHERE subscription_status IS NULL;