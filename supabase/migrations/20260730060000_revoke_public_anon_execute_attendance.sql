-- This fix was applied directly to production earlier in the attendance
-- build (see CHANGELOG.md) but was never committed as a migration file
-- until now — found during a docs-accuracy pass. Committing it so a
-- fresh schema rebuild from supabase/migrations/*.sql actually matches
-- what's live, per the promise in SETUP.md/BACKUP.md. Applying this again
-- against the already-patched production database is a safe no-op
-- (REVOKE on a grant that's already absent does nothing).

REVOKE EXECUTE ON FUNCTION public.save_attendance(uuid, date, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_attendance_status(uuid, date, text) FROM PUBLIC, anon;
