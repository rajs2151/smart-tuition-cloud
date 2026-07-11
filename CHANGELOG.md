# Changelog

All notable changes to this project, in reverse chronological order (newest
first). Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

---

## 2026-07-10

### Added
- `docs/HANDOVER.md` — full project handover (status, backend, deployment,
  known issues, decisions, next tasks, testing status).
- `CHANGELOG.md`, `KNOWN_ISSUES.md`, `ROADMAP.md` (this file and its two
  companions).

### Fixed
- **PDF export color rendering**: `src/lib/pdf/export.ts` used
  `html2canvas` (`^1.4.1`), whose color parser doesn't understand the
  `oklch()` function that `src/styles.css` uses throughout the theme (79
  uses) — this threw `Attempting to parse an unsupported color function
  "oklch"` or silently mis-rendered colors on both PDF export call sites
  (receipt PDF, admission form PDF). Replaced the dependency with
  `html2canvas-pro`, an API-compatible fork that adds `oklch()`/`oklab()`/
  `lab()`/`lch()`/`color()` support — only the import and the `package.json`
  entry changed. `tsc --noEmit`, `eslint`, and `vite build` all pass clean.
  Not verified: an actual visual check of an exported PDF in a real
  browser (no headless browser available in the fixing environment) —
  worth a quick manual export-and-open check.
- **Disabled-account regression**: an automated merge had silently dropped
  `institute_members.access_enabled` and the `create_institute_with_owner`
  RPC from the generated `types.ts`, which cascaded into the "Account
  Disabled" feature being silently removed from `session.ts` and an unsafe
  type-cast being added to `auth-gate.tsx` to hide the resulting type error.
  Restored the correct types (verified against the live schema directly)
  and the original logic.

### Changed
- Merged in parallel work from Lovable's editor (Bulk Student Import
  feature, an independent `.env` update) with the ongoing infrastructure
  work in this session — resolved via normal git merges.
- Temporarily removed `.github/workflows/validate-migrations.yml` from a
  push (see **Known Issues** — token scope limitation), to avoid blocking
  everything else on it.

---

## 2026-07-09

### Added
- `supabase/seed.sql` — realistic demo data (one institute, two batches,
  five students, three payments/receipts, two audit log entries).
  Verified twice against the live project: idempotent, and readable
  end-to-end under RLS as the demo owner.
- `SETUP.md` — zero-prior-knowledge path from `git clone` to a running app.
- `BACKUP.md` — export/restore guide (Supabase auto-backups, CLI dump,
  direct `pg_dump`/`pg_restore`, with a specific note on `auth.users`).
- `.github/workflows/validate-migrations.yml` — CI check that spins up a
  real local Supabase stack and applies every migration against it
  (written and verified logically; see **Known Issues** for push status).
- Migration `20260709055109_fix_authenticated_execute_grants.sql`.
- **Bulk Student Import** feature (spreadsheet import for students) —
  added in parallel by Lovable's editor.

### Fixed
- **Critical grant bug**: migration
  `20260703064947_..._revoke_public_execute_on_helpers` had revoked
  `EXECUTE` on `is_member()`/`is_owner()` from `authenticated` and nothing
  ever re-granted it — breaking every RLS-protected query for every real
  signed-in user, including the very first membership lookup right after
  sign-in. Confirmed directly by simulating an authenticated request
  against the live database, not inferred from reading SQL. Very likely a
  second, independent root cause behind the original "always stuck on
  onboarding" bug, on top of the client-side race condition fixed on
  2026-07-07.
- Over-permissive `next_receipt_number` grant (was callable by `PUBLIC`/
  `anon`, flagged by Supabase's security advisor) — tightened to
  `authenticated`-only, same migration as above.

### Changed
- **Migrated to a self-owned Supabase project** — moved off the old,
  Lovable-managed project (`fqusjrsboyinbrblauma`, actually reachable only
  through a Lovable Cloud proxy domain, not a direct Supabase URL) onto a
  project the repo owner controls directly (`xrkfbsupszhsjevcmntc`). Full
  detail in `CUTOVER.md`. Confirmed beforehand: no production data existed
  to migrate.
- Updated `supabase/config.toml`, `.env`, and `docs/backend-architecture.md`
  to reflect the new project; corrected an earlier documentation mistake
  (had assumed `SUPABASE_URL` was a direct `*.supabase.co` URL — it was
  actually the Lovable proxy domain).

### Removed
- Reliance on the old, Lovable-managed Supabase project.

---

## 2026-07-08

### Added
- `docs/backend-architecture.md` — full backend/authentication architecture
  audit: where the backend lives, every env var, the complete login flow,
  database schema (every table/PK/relationship), every RPC/trigger, and
  how to access the backend.

### Changed
- **Replaced Google OAuth with email/password sign-in** entirely. Google
  sign-in had failed twice for environment-specific reasons unrelated to
  the app's own logic (see Fixed, 2026-07-07) — rather than keep chasing
  external OAuth configuration, switched to Supabase's built-in
  email/password auth (`signUp`/`signInWithPassword`), removing that whole
  category of "works here, not there" bugs.

### Removed
- The Google sign-in button and the now-unused `@/integrations/lovable`
  import from `auth-gate.tsx`.

---

## 2026-07-07

### Added
- Subscription-status gating (`trial`/`active`/`expired`/`blocked`) —
  pre-existing work at the start of this engagement.

### Fixed
- **Original onboarding bug** (the app always showing "Set up your
  institute," even after one was successfully created): root-caused to a
  client-side race condition in `initAuth()` — both `getSession()` and
  `onAuthStateChange()` fired independent, unsequenced membership lookups
  on every load, and a stale "no membership yet" response could resolve
  *after* a fresh "membership just created" response and silently
  overwrite it. Fixed with a single listener + a generation-counter guard
  in `src/lib/auth/session.ts`, so a late-resolving stale result can never
  clobber a newer one.
- **Duplicate/orphan institute creation**: the client-side
  check-then-insert institute creation had a real race window (two fast or
  duplicate submissions could both pass the "do I already have an
  institute" check before either insert committed). Replaced with a single
  atomic, idempotent `create_institute_with_owner` RPC, backed by a
  database-level unique index (one owner per user) as the actual
  guarantee.
- Removed a redundant, duplicate database trigger
  (`trg_add_creator_as_owner`) that had been added by an earlier,
  misdiagnosed fix attempt — the original trigger already did the job.
- Google OAuth sign-in 404ing on `/~oauth/initiate` on Vercel — traced to
  `@lovable.dev/cloud-auth-js` redirecting to a path only handled by
  Lovable Cloud's own hosting edge layer, which doesn't exist outside
  Lovable's own infrastructure. Switched the sign-in call to Supabase's own
  native `signInWithOAuth`, which then surfaced a *different*, real issue
  (missing OAuth provider secret in Supabase) — ultimately resolved by
  removing Google OAuth entirely the next day (see 2026-07-08).

### Added (continued)
- `institute_members.access_enabled` (per-member disable switch,
  independent of institute-level `subscription_status`) and its "Account
  Disabled" screen.
- Migration `20260707120000_fix_onboarding_race_and_access_control.sql`.

---

## Earlier history

Commit history prior to 2026-07-07 predates this changelog and reflects
the application's original build (via Lovable) — core schema, RLS
policies, the dashboard, batches/students/payments/receipts/expenses/
recovery/recycle-bin features, and the initial (later replaced) Google
OAuth integration. Not itemized here in detail; see
`supabase/migrations/20260703064918_...sql` for the original schema and
`docs/backend-architecture.md` for the current state of the whole system.
