# Supabase Project Cutover

**Date:** July 9, 2026
**From:** `fqusjrsboyinbrblauma` (Lovable-managed, accessed only through a Lovable Cloud proxy domain — not directly administrable by the repo owner)
**To:** `xrkfbsupszhsjevcmntc` ("smart-tuition-cloud", under the `rajs2151` Supabase account, region `ap-south-1`)
**Reason:** move to a Supabase project the repo owner fully controls (dashboard access, key rotation, billing, etc.), with no Lovable-managed proxy layer in between.
**Data carried over:** none — confirmed with the repo owner that no production users or customer data existed on the old project, so this was a clean cutover rather than a migration-with-data-transfer.

---

## What actually changed

### 1. `supabase/config.toml`

```diff
- project_id = "fqusjrsboyinbrblauma"
+ project_id = "xrkfbsupszhsjevcmntc"
```

### 2. `.env` (repo root)

All six variables replaced. Also worth noting: the **old** `SUPABASE_URL` /
`VITE_SUPABASE_URL` values were not actually direct Supabase URLs — they were
a Lovable Cloud proxy domain (`https://c--<uuid>-prod.lovable.cloud`). That
only became apparent once the real value was inspected directly (an earlier
version of `docs/backend-architecture.md` had assumed, incorrectly, that it
was a normal `*.supabase.co` URL). The app now talks to Supabase directly,
with no proxy layer in between.

| Variable | Old value (shape) | New value |
|---|---|---|
| `SUPABASE_PROJECT_ID` | `fqusjrsboyinbrblauma` | `xrkfbsupszhsjevcmntc` |
| `VITE_SUPABASE_PROJECT_ID` | `fqusjrsboyinbrblauma` | `xrkfbsupszhsjevcmntc` |
| `SUPABASE_URL` | `https://c--<uuid>-prod.lovable.cloud` (Lovable proxy) | `https://xrkfbsupszhsjevcmntc.supabase.co` (direct) |
| `VITE_SUPABASE_URL` | same Lovable proxy domain | `https://xrkfbsupszhsjevcmntc.supabase.co` (direct) |
| `SUPABASE_PUBLISHABLE_KEY` | old project's anon key | new project's legacy anon key (JWT, `role: anon`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | old project's anon key | new project's legacy anon key (JWT, `role: anon`) |

The new project also exposes a modern `sb_publishable_...`-format key
(Supabase's newer key system). The legacy JWT-format anon key was used
instead, to guarantee compatibility with the exact `@supabase/supabase-js`
version already pinned in `package.json` without needing to test a
different key format under time pressure. Switching to the modern
publishable-key format later is a reasonable follow-up, not required.

### 3. `docs/backend-architecture.md`

Every reference to the old project ID/URL updated to the new project.
Also corrected the incorrect assumption (made when that doc was first
written) that `SUPABASE_URL` was a direct `*.supabase.co` URL — it was
actually the Lovable proxy domain mentioned above. The RPC table in §6 was
updated with the grant-bug finding below.

### 4. New migration: `supabase/migrations/20260709055109_fix_authenticated_execute_grants.sql`

**This is the most important part of this cutover, and it isn't a config
change — it's a real, previously-undiscovered bug fix.**

While verifying the new project end-to-end (see "Verification" below), a
critical, pre-existing bug was found and fixed:

> Migration `20260703064947` (`revoke_public_execute_on_helpers`, one of the
> original migrations — present since long before this cutover, and
> presumably also present on the old Lovable-managed project) revoked
> `EXECUTE` on the `is_member()` and `is_owner()` functions from `PUBLIC`,
> `anon`, **and `authenticated`** — but nothing afterward ever re-granted
> `EXECUTE` back to `authenticated`. Both functions are called from inside
> the RLS policy on every tenant-scoped table (`institutes`,
> `institute_members`, `batches`, `students`, `payments`, `receipts`,
> `audit_logs`), and PostgREST executes every real API request as the
> `authenticated` Postgres role. Without `EXECUTE` on those two functions,
> **every RLS-protected query for every real signed-in user failed** with
> `permission denied for function is_member` — including the very first
> membership lookup the app performs immediately after sign-in
> (`loadActiveInstitute()` in `src/lib/auth/session.ts`).

This was confirmed directly, not inferred: a test authenticated request was
simulated against the new project's database (inserting a throwaway
`auth.users` row and setting `request.jwt.claims` to act as that user, then
running the exact query the app runs), and it failed with that exact
permission error before the fix, and succeeded afterward. See "Verification"
below for the full sequence.

**This means the original "always stuck on onboarding" bug very likely had
two independent causes stacked on top of each other** — the client-side
race condition fixed earlier in this repo's history, *and* this
permission-grant bug, which would have caused every membership lookup to
fail regardless of any client-side fix. Since the old project was never
independently accessible to inspect, it isn't confirmed whether the old
project had the same grant bug — but it inherited the same migration
history, so it's a reasonable assumption that it did.

**Fix applied** (both directly to the live project via migration, and
committed to the repo so a fresh project built from `supabase/migrations/`
doesn't reintroduce the bug):

```sql
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid, uuid) TO authenticated;
```

A second, lower-severity issue was fixed in the same migration:
`next_receipt_number(uuid)` was granted to `PUBLIC` (and therefore `anon`)
with no restriction — flagged by Supabase's own security advisor
(`get_advisors`). Tightened to `authenticated`-only, since `anon` has no
legitimate reason to call it:

```sql
REVOKE EXECUTE ON FUNCTION public.next_receipt_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(uuid) TO authenticated;
```

No other RLS policies, grants, or schema objects were changed. Per the
instruction to preserve existing RLS policies unless modification is
absolutely necessary: this modification *was* absolutely necessary — the
policies were already correct, but were unusable by real users due to the
missing grant underneath them.

### 5. Full-repo search for remaining old-project references

```
grep -rln "fqusjrsboyinbrblauma" . --exclude-dir=node_modules --exclude-dir=.git
```

Found and fixed in exactly 3 files: `.env`, `supabase/config.toml`,
`docs/backend-architecture.md` (all listed above). No other file in the
repository — source code, other docs, CI config, package manifests —
referenced the old project ID, URL, or the Lovable proxy domain.

---

## Verification performed

Since the new project is now live and under this repo owner's own account,
verification was done directly against it via the Supabase connector,
simulating exactly what the app does over its real REST API:

1. **Schema check** — confirmed all 7 expected tables exist
   (`institutes`, `institute_members`, `batches`, `students`, `payments`,
   `receipts`, `audit_logs`), each with RLS enabled, matching columns, and
   matching foreign keys.
2. **Security advisor check** — no missing-RLS findings; two expected
   "SECURITY DEFINER callable by authenticated/anon" warnings for the two
   RPCs that are *meant* to be callable that way, plus the `next_receipt_number`
   over-grant noted above (now fixed).
3. **Simulated sign-up → onboarding, before the grant fix:**
   - Inserted a throwaway `auth.users` row (mirroring what
     `supabase.auth.signUp()` produces).
   - Called `create_institute_with_owner(...)` as that user — **succeeded**
     (this RPC is `SECURITY DEFINER` and its internal queries bypass RLS,
     so it wasn't affected by the grant bug).
   - Immediately queried `institute_members` as that same authenticated
     user — the exact query `loadActiveInstitute()` runs — **failed** with
     `permission denied for function is_member`. This reproduced the bug.
4. **Applied the grant-fix migration.**
5. **Re-ran the full simulation with a fresh test user:**
   - `create_institute_with_owner(...)` → succeeded.
   - Membership read-back (`institute_members` query) → **succeeded**,
     returned `{ role: "owner", access_enabled: true }` as expected.
   - Institute read-back (`institutes` query) → succeeded.
   - **Idempotency check:** called `create_institute_with_owner(...)` a
     second time as the same user with different arguments → returned the
     *original* institute, and the owner-membership count for that user
     stayed at exactly 1 (confirms the duplicate-institute race-condition
     fix from `20260707120000_fix_onboarding_race_and_access_control.sql`
     holds on the new project too).
   - **Tenant isolation check:** a third, unrelated test user querying
     `institute_members`/`institutes` directly saw **zero rows** — RLS
     correctly isolates tenants, the grant fix didn't over-open access.
6. **Cleaned up all test data** (test institutes and test `auth.users` rows)
   after verification — the new project is left empty, exactly as it was
   before this session.

### What was *not* verified this way, and why

The above confirms the **database layer** (RLS, RPCs, triggers, grants)
works correctly end-to-end. It does **not** confirm the actual HTTP-level
`supabase.auth.signUp()` / `signInWithPassword()` flow through Supabase's
GoTrue Auth service, since that requires a real network call to the
project's Auth API — which wasn't reachable from this environment's
sandboxed network. **This still needs a real click-through test in a
browser** against the deployed app once Vercel's environment variables are
updated (see below) — specifically: sign up a real account, confirm you're
taken to "Set up your institute," create one, and confirm you land on the
dashboard without bouncing back to onboarding.

---

## What you need to update outside this repository

### Vercel (or wherever this app is actually deployed)

Update these environment variables to match the new `.env` values above,
then redeploy:

```
SUPABASE_PROJECT_ID=xrkfbsupszhsjevcmntc
SUPABASE_URL=https://xrkfbsupszhsjevcmntc.supabase.co
SUPABASE_PUBLISHABLE_KEY=<the anon key — see .env in this repo, or Supabase Dashboard → Settings → API>
VITE_SUPABASE_PROJECT_ID=xrkfbsupszhsjevcmntc
VITE_SUPABASE_URL=https://xrkfbsupszhsjevcmntc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<same anon key as above>
```

### Supabase dashboard (new project)

- **Authentication → Providers → Email**: confirm it's enabled, and decide
  on/off for "Confirm email" (see the note on this from earlier in the
  project's history — off is simpler for a first launch, on is more
  standard for production).
- **Authentication → URL Configuration**: set **Site URL** and add
  **Redirect URLs** for your actual Vercel deployment URL(s).
- No Google OAuth setup is needed — the app now uses email/password only.

### Nothing else needs updating

No other file, service, or third-party integration in this codebase
referenced the old project.

---

## Rollback

If anything goes wrong, the previous `.env`/`config.toml` values are
recoverable from git history (the commit immediately before this one on
`main`). The old project (`fqusjrsboyinbrblauma`) itself was not deleted or
modified as part of this cutover — only this repo's configuration was
changed to stop pointing at it.
