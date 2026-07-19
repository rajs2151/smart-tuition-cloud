# Changelog

All notable changes to this project, in reverse chronological order (newest
first). Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

---

## 2026-07-18 (Session 3, part 2)

### Fixed
- **Batch Total Course Fee changes weren't reaching enrolled students.**
  `student.courseFee`/`totalFee` are copied from the batch once, at
  creation — editing a batch's fee afterward only updated the `batches`
  row. Added `sync_batch_course_fee` (new migration
  `20260718090000_sync_batch_course_fee.sql`), called from `updateBatch()`
  only when the fee actually changes; needed as a DB function because
  `total_fee = new_fee + admission_fee` is a per-row expression
  (`admission_fee` differs per student) that a single client `.update()`
  call can't express. Also widened that save path's cache invalidation to
  `refetchType: "all"`, since this now writes to `students` too.

### Added
- **Batch Collection Report** — a second, additive report per batch card:
  From/To date pickers (default to the current month) + "Download
  Collection Report", a transaction-level export (one row per payment, no
  aggregation) distinct from the existing per-student Batch Fee Report.
  New adapter function `listPaymentsForBatchInRange()` queries only that
  batch's payments in that date range server-side, not the full
  institute payment list filtered client-side.

## 2026-07-16 (Session 3, part 1)

### Fixed
- **Recurring "different pages disagree on Collected/Due" bug**, found
  and fixed on five separate screens over several passes: Student
  Details, Fees list, Batch Fee Report, Dashboard, Student List, and the
  individual receipt page. Root cause every time: reading
  `student.paidFee` (a column reconciled by a best-effort background
  step) instead of deriving Collected from a live sum over that
  student's non-voided payments. Also widened `invalidateQueries()` to
  `{ refetchType: "all" }` at every payment-mutating call site (record,
  edit, void, bulk import, restore/purge) instead of the narrower
  per-page refetch pattern that let this slip through repeatedly.
- **"Save & Generate Receipt" showed an error even though the payment and
  receipt were both created.** Traced the full call chain: `recordPayment()`
  durably inserts the payment, then calls `reconcileStudentPaid()`
  (updates the student's cached `paid_fee`) — that reconcile step could
  throw for unrelated transient reasons *after* the payment already
  committed, rejecting the whole call. Made `reconcileStudentPaid()`
  best-effort (log, don't throw), which also silently fixed the same
  latent bug in edit/void/delete/restore.
- **Record Payment button on Student Details did nothing** —
  `RecordPaymentDialog` only existed as a private component inside
  `fees.tsx`. Extracted to `src/components/record-payment-dialog.tsx` as
  the one shared implementation.
- **Duplicate receipts from repeated clicks** — "Save & generate receipt"
  had no loading state or re-entrancy guard, so a slow response (or an
  impatient re-click) could fire multiple payments. Added a `submitting`
  guard + disabled button, and a same-day/same-amount/same-mode
  duplicate-payment warning.
- **Historical payment import created no payment history** — the
  importer wrote `paidFee` directly onto the student row but never
  called `recordPayment()`, so Payment Timeline/receipts stayed empty
  for imported students. Fixed to call the same function manual payments
  use, gated on `paidFee > 0`.

### Added
- **Multi-user Team Members** — owner/admin/teacher/accountant roles,
  invite by email with 5-seat cap, pending-invite auto-linking on first
  sign-in, owner-only management (matching the product's own permission
  table). Two migrations
  (`20260714120000_team_members_schema.sql`,
  `20260714120001_team_members_rpcs_and_rls.sql`). Integrated from a
  separate session's partial implementation; found and fixed two real
  bugs in it before applying (wrong RLS policy names in the `DROP
  POLICY` statements, and `getActorName()` matching the wrong field —
  see `docs/HANDOVER.md` Session 3 for detail).
- **Receipt-specific contact info** — Phone/Email/Website on receipts can
  be overridden independently of the Institute tab, falling back live
  (not copied) when not overridden. New migration
  `20260713080000_add_receipt_contact_overrides.sql`.
- **Selectable Payment Date** on manually recorded payments (previously
  always stamped today's date).
- **Batch Fee Report** — downloadable per-batch Excel export (Student
  Name / Paid Fee / Remaining Fee).
- **Dashboard redesign** — Collection Efficiency KPI, configurable-
  threshold Students Needing Follow-up card (replacing Payment Modes),
  click-through drill-down modals on Total Students/Total Collection/
  Pending Fees, and a real fix to the Collection Trend chart (was
  reading a hardcoded frozen date and plotting a fabricated random
  series that wasn't even rendered).

### Changed
- Subscription page pricing text updated to ₹5,999/year (display only,
  no billing-logic change).

---

## 2026-07-11 – 2026-07-12 (Session 2) — five PRs, #1–#3 merged, #4 open at the time

### Fixed
- PDF export crash: `html2canvas` couldn't parse the `oklch()` color
  function used throughout the theme — swapped for `html2canvas-pro`.
- Leading-zero controlled-number-input bug (batch Capacity/Monthly fee
  fields) — same class of bug still open elsewhere, see `KNOWN_ISSUES.md`.
- Bulk import phone validation regression — `isValidPhone` had been
  loosened to accept any 10-digit string, dropping the `[6-9]`
  Indian-mobile-prefix check. Restored.
- Batch Start/End dates erroring on empty input — `fromBatch()` was
  sending `''` into a Postgres `DATE` column; coerced to `null`.
- Blank WhatsApp greetings — `?? "Parent"` doesn't catch an empty
  string, and a blank parent-name field produces exactly that.
- `audit_logs` existed as a real table but `logAudit()` only ever wrote
  to `localStorage` — fixed to write through to both.

### Added
- Batches store one **Total Course Fee** instead of a Monthly Fee
  (migration renames + backfills `monthlyFee * 12`).
- Student Admission auto-fills Course Fee from the selected batch.
- Edit Student / Archive Student, Edit Payment / Void Payment (PR #4,
  open as of this writing — see `docs/HANDOVER.md` for full detail).

### Changed
- Fees screen: every "Pay" surface renamed to "Receive Payment".

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
