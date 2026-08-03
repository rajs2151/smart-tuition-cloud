# Project Handover

_Last updated: July 31, 2026 (Session 4 — Attendance & Expenses systems)_
_Last updated: August 3, 2026_

---

# Project Overview

**Vidyafee** (repo: `smart-tuition-cloud`) is a fee-management SaaS for
coaching institutes/tuition centers. An institute owner signs up, creates
their institute, and manages batches, students, fee collection, receipts,
expenses, and fee-recovery tracking from a single dashboard. Staff members
can be added to help run day-to-day operations under the same institute.

**Stack:** TanStack Start (React, SSR) frontend, deployed to Vercel; Supabase
(Postgres + Supabase Auth + auto-generated REST API) as the entire backend —
no custom API server. All data access is enforced by Postgres Row Level
Security, not application code. Full architecture reference:
`docs/backend-architecture.md`.

**Core entities:** an `institute` is the tenant. Each user is linked to an
institute via `institute_members` with a `role`
(`owner`/`staff`/`admin`/`teacher`/`accountant` — `staff` kept for backward
compatibility with pre-Team-Members rows, `admin`/`teacher`/`accountant`
added by the Team Members feature) and a per-member `access_enabled` flag.
Everything else (`batches`, `students`, `payments`, `receipts`,
`audit_logs`, `attendance_sessions`, `attendance_absences`,
`expense_categories`, `expenses`) is scoped to one institute.

---

# Current Status

### Completed features
- Email/password sign-up and sign-in (Supabase Auth)
- Onboarding: first-time "Create Your Institute" flow, atomic
  institute+owner-membership creation, race-condition-free session handling
- Per-member `access_enabled` disabled-account screen
- Institute-level subscription status gating (`trial`/`active`/`expired`/`blocked`)
- Dashboard (redesigned in Session 3 — see below), batches, students (list +
  detail), bulk student import (spreadsheet, now creates real historical
  payment records, not just a fee-summary snapshot), fees,
  receipts (list + detail + printable receipt view), fee recovery
  tracking, recycle bin (soft-delete recovery), settings
- **Expenses — fully server-persisted (Session 4).** Previously listed
  here as simply "done," but was actually entirely client-side
  `localStorage` until Session 4, which was the confirmed root cause of
  a real user-reported data-loss incident. Now backed by `expenses`/
  `expense_categories` tables (RLS, soft-delete, per-institute category
  seeding), plus two profitability RPCs
  (`get_profitability_summary`/`get_expense_breakdown_by_category`). See
  **Session 4** below and `docs/backend-architecture.md` §5/§9.
- **Attendance tracking (Session 4).** Per-batch daily roll-call
  (present-by-default grid), holiday/cancelled session marking, a
  Reports drill-down (batch → day → absentee list), a top-level Notify
  tab (flat cross-batch today-only absentee list with live WhatsApp
  send), and persistent server-side "sent" tracking
  (`attendance_absences.notified_at`) that survives a refresh or a
  different device. Two RPCs (`save_attendance`/`mark_attendance_status`)
  with `is_member()` and cross-batch-id guards. See **Session 4** below.
- Full RLS-protected multi-tenancy across all data tables
- Historical payment import (Paid Fee / Payment Date / Payment Mode /
  Description columns), reusing the same `recordPayment()` path as manual
  payments
- Selectable Payment Date on manual payments (defaults to today, blocks
  future dates)
- Receipt-specific contact info override (Phone/Email/Website), falling
  back live to the Institute tab's values
- Batch Fee Report and Batch Collection Report (date-range, transaction-
  level) downloadable Excel exports per batch
- Multi-user Team Members (owner/admin/teacher/accountant roles, invite by
  email, pending-invite auto-linking on first sign-in, 5-seat cap) — see
  Session 3 below
- Redesigned Dashboard: click-through drill-downs (Total Students by
  standard, Total Collection by batch, Pending Fees list, Follow-up list),
  Collection Efficiency KPI, fixed Collection Trend chart
- PDF export (receipts, admission form) via `html2canvas-pro`, fixed to
  handle the `oklch()`/`oklab()`/`color()` colors used throughout the theme
- Bulk student import: Student Name-only rows, robust phone normalization,
  phone/parent-phone duplicate detection
- Batch fee model: batches store one **Total Course Fee** (not a monthly
  rate); Student Admission auto-fills Course Fee from the selected batch,
  read-only by default with an explicit override toggle; batch Start/End
  dates are genuinely optional
- Fees screen consistently uses "Receive Payment" language (the institute
  receives money, it doesn't pay it)
- WhatsApp payment acknowledgement always greets by parent name or falls
  back to "Dear Parent," — never blank
- Controlled editing: a ⋮ overflow menu on Student and Payment rows for
  **Edit Student**, **Archive Student** (soft-delete/recycle, not permanent
  delete), **Edit Payment** (amount/date/mode/notes only), **Void Payment**
  (stays visible in history, excluded from totals) — all owner-only, with
  audit-logged old/new value snapshots
- **Attendance system** (Session 4, PRs #6–#8) — per-batch/per-student
  attendance marking, absence-only storage (`attendance_sessions` +
  `attendance_absences`), holiday/cancelled-lecture states, a lock-window
  setting restricting teacher/staff edits after a configurable cutoff
  (owner/admin always exempt), bilingual WhatsApp absence notices, and a
  Reports drill-down (batch → day → per-student notify list, sent/pending
  state persisted server-side). See Session 4 below for the two-round
  history (a v1 build, then a v2 correcting a stale-localStorage template
  bug and adding the standalone Notify tab).
- **Expenses & profitability system** (Session 4, PR #9) — server-persisted
  expenses (was previously in-memory only), categories with custom
  additions, a Profitability tab computing Net Profit server-side
  (`getProfitabilitySummary` RPC) from real revenue minus real expenses,
  Excel/CSV export, and a category-breakdown RPC
  (`get_expense_breakdown_by_category` — defined and reachable, but not
  currently wired to any UI component, see `KNOWN_ISSUES.md`).
- **Mobile/UX audit rounds** (Session 4, PRs #11, #12, #16, #18) — sidebar
  and tap-target fixes, dialog font-size/zoom-trigger fixes, `staleTime`
  and route-preload tuning, `exceljs` code-splitting (kept it out of the
  shared bundle), settings tab-bar scroll fix, header cleanup, receipts
  list restyled from flat divided rows to individually-carded receipts
  (matching the Batches list's existing card pattern), student card
  three-dot-menu repositioning, and payment-mode badge repositioning on
  receipt cards.

### Features under development
- None actively in progress as of this handover. The most recent work (see
  **Recent Changes → Session 2**) is four merged PRs (#1–#3) plus one open
  PR (#4, controlled editing) awaiting review/merge and, critically,
  awaiting the new migrations being applied to the live database (see
  **Manual Steps Remaining** — merging a PR does **not** run its
  migration).

### Pending tasks
- Staff invitation UI — the schema/RLS already support an owner adding a
  `staff` member (`institute_members` insert, policy-restricted to
  owners), but there's no UI for it yet. An owner would currently have to
  do this via direct SQL.
- CI migration-validation workflow is written but not yet pushed (see
  **Manual Steps Remaining**).
- No institute-switcher UI for a user who belongs to more than one
  institute (edge case; a unique index currently limits one *owned*
  institute per user, but a `staff` member could theoretically belong to
  more than one).
- No "Admin" role tier — the role model is only `owner`/`staff`. The new
  controlled-editing feature's "Owner and Admin only" requirement was
  mapped to `owner`-only pending a real decision on whether a third role
  tier is needed.
- RLS on `students`/`payments` is not yet column-aware — any member can
  still `UPDATE` either table at the database level, not just owners. The
  new Edit/Void UI hides itself for non-owners, but that's a UI convenience,
  not a security boundary. See **Known Issues** for why this wasn't
  tightened blindly.
- The Recycle Bin / Audit Log page (`recycle-bin.tsx`) still reads from
  browser `localStorage`, not the database — see **Known Issues**.
- Same-message-flag repetition risk in `add-student-dialog.tsx`,
  `expenses.tsx`, and `settings.tsx`: the leading-zero controlled-number-input
  bug (fixed in `batches.tsx` in an earlier session) still exists in these
  three other numeric inputs — flagged, not yet fixed.

---

# Backend

**Supabase Project ID:** `xrkfbsupszhsjevcmntc` (name: "smart-tuition-cloud",
region `ap-south-1`, Postgres 17). This is a project under the repo owner's
own Supabase account — see **Important Decisions** for why this replaced the
previous Lovable-managed project.

### Database architecture
11 tables, all with RLS enabled: `institutes`, `institute_members`,
`batches`, `students`, `payments`, `receipts`, `audit_logs`,
`attendance_sessions`, `attendance_absences`, `expense_categories`,
`expenses`, plus Supabase's built-in `auth.users`. Full table-by-table
breakdown (columns, PKs, FKs, purpose) is in `docs/backend-architecture.md`
§5. 15 migrations committed, all applied to the live database as of this
update:
§5. 15 migrations committed, in order:

```
20260703064918_179279b9-...  initial schema
20260703064947_7e831c27-...  revoke_public_execute_on_helpers (see Known Issues — this is what later broke things)
20260707084455_feb25cb6-...  wire owner-membership trigger + backfill
20260707085440_be05dcf2-...  add subscription_status
20260707120000_fix_onboarding_race_and_access_control  atomic institute creation RPC, access_enabled, one-owner-per-user unique index
20260709055109_fix_authenticated_execute_grants        fixes the grant bug from migration 2
20260711130000_batch_total_course_fee                  batches.monthly_fee -> total_course_fee (renamed, backfilled *12)
20260711140000_payment_void_and_audit_diffs            payments.voided/voided_at/voided_by, audit_logs.old_value/new_value, students.date_of_birth
20260713080000_add_receipt_contact_overrides           receipt phone/email/website overrides
20260714120000_team_members_schema                     institute_members role expansion (admin/teacher/accountant), status
20260714120001_team_members_rpcs_and_rls               invite_member/change_member_role/remove_member, is_owner_or_admin
20260718090000_sync_batch_course_fee                   sync_batch_course_fee RPC + trigger
20260730052621_attendance_system                       attendance_sessions, attendance_absences, save_attendance, mark_attendance_status, institutes.attendance_language/attendance_lock_time
20260730060000_revoke_public_anon_execute_attendance    REVOKE EXECUTE FROM PUBLIC, anon on the two attendance RPCs (applied live earlier; committed as a file only in Session 4 — see Known Issues #22)
20260730181401_attendance_notified_at                   attendance_absences.notified_at (WhatsApp "sent" tracking)
20260731000000_expenses_system                          expenses, expense_categories, seeding trigger, get_profitability_summary, get_expense_breakdown_by_category
20260713080000_add_receipt_contact_overrides           receipt-specific phone/email/website overrides
20260714120000_team_members_schema                     admin/teacher/accountant roles added to member_role enum
20260714120001_team_members_rpcs_and_rls               invite_member/change_member_role/remove_member RPCs + RLS
20260718090000_sync_batch_course_fee                   propagates a batch fee change to every enrolled student
20260730052621_attendance_system                       attendance_sessions/attendance_absences, save_attendance/mark_attendance_status RPCs
20260730181401_attendance_notified_at                  attendance_absences.notified_at, for the Notify tab's sent/pending tracking
20260731000000_expenses_system                         expense_categories/expenses, getProfitabilitySummary/get_expense_breakdown_by_category RPCs
```

All 15 have been applied to the live Supabase project — the "Session 3
migrations not yet applied" issue in earlier versions of this document is
resolved (see `KNOWN_ISSUES.md`); everything built in Session 4 has been
working end-to-end against the live database, which wouldn't be possible
otherwise. **Not yet committed as a migration file**, despite being
already applied live: a `REVOKE EXECUTE ... FROM PUBLIC, anon` hardening
fix for `save_attendance`/`mark_attendance_status`, sitting in the still-
open, never-merged PR #10. Re-applying it is a safe no-op per its own
comment (revoking an already-absent grant does nothing) — worth pulling
out of PR #10 and landing on its own regardless of what happens to the
rest of that PR.

### Authentication
Supabase Auth, email + password only (`supabase.auth.signUp` /
`signInWithPassword`). No OAuth provider configured. Session persisted in
`localStorage` by supabase-js (`persistSession`, `autoRefreshToken`).
Single source of session truth: `src/lib/auth/session.ts`'s
`onAuthStateChange` listener, generation-counter-guarded against race
conditions. Full login-flow trace: `docs/backend-architecture.md` §3.

### RLS
Every tenant-scoped table's policies call `is_member(institute_id, auth.uid())`
or `is_owner(institute_id, auth.uid())` — both `SECURITY DEFINER` helper
functions. **These two functions must have `EXECUTE` granted to
`authenticated`** or every RLS-protected query breaks — this exact grant was
missing from migration 2 through migration 5 (see **Known Issues** /
**Important Decisions**), fixed in migration 6.

### RPCs
- `is_member(_institute, _user)`, `is_owner(_institute, _user)`,
  `is_owner_or_admin(_institute, _user)` — internal RLS helpers,
  `SECURITY DEFINER`.
- `next_receipt_number(_institute)` — atomically increments/returns the next
  formatted receipt number. `authenticated`-only (tightened from an
  over-permissive `PUBLIC`/`anon` grant in migration 6).
- `create_institute_with_owner(_name, _phone, _address, _email)` — atomic,
  idempotent institute + owner-membership creation. `authenticated`-only.
- `invite_member`/`change_member_role`/`remove_member` — Team Members
  management RPCs (Session 3), owner-only (see Known Issues #15).
- `sync_batch_course_fee(_batch_id, _new_fee)` — propagates a batch's Total
  Course Fee change to every enrolled student's `total_fee` (Session 3).
- `save_attendance(_batch_id, _session_date, _absent_student_ids)` /
  `mark_attendance_status(_batch_id, _session_date, _status)` — Session 4.
  Both `is_member`-guarded; `save_attendance` additionally rejects any
  student id that doesn't belong to `_batch_id`. `authenticated`-only,
  `PUBLIC`/`anon` explicitly revoked (see Known Issues #22).
- `get_profitability_summary(_institute, _from, _to)` /
  `get_expense_breakdown_by_category(_institute, _from, _to)` — Session 4.
  `is_member`-guarded, `authenticated`-only. Full detail in
  `docs/backend-architecture.md` §6.

### Storage
Not used. No Supabase Storage buckets exist or are referenced in code. The
`students.photo` column is a plain text field (e.g. a URL), not a Storage
file reference.

---

# Deployment

### GitHub
`rajs2151/smart-tuition-cloud`, public, default branch `main`. Note: during
this session, changes were being made both by me (via a direct git clone in
a sandboxed environment) and by Lovable's own editor/bot
(`gpt-engineer-app[bot]`) in parallel — both converged correctly via normal
git merges, but this is worth knowing if two workflows are being used to
edit this repo simultaneously going forward (see **Known Issues**).

### Vercel
Deployed from `main`. **Environment variables must be updated to match the
new Supabase project** (see below) if they haven't been already — this
is the one deployment-side step that cannot be done from the repo alone.

### Environment variables required

```
SUPABASE_PROJECT_ID=xrkfbsupszhsjevcmntc
SUPABASE_URL=https://xrkfbsupszhsjevcmntc.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon key — see .env in repo, or Supabase Dashboard → Settings → API>
VITE_SUPABASE_PROJECT_ID=xrkfbsupszhsjevcmntc
VITE_SUPABASE_URL=https://xrkfbsupszhsjevcmntc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<same anon key as above>
```

`SUPABASE_SERVICE_ROLE_KEY` is only needed if the currently-unused
`supabaseAdmin` client (`src/integrations/supabase/client.server.ts`) is
ever wired into a server function — not required for the app to run today.

---

# Recent Changes

Everything below happened in this working session, in order:

1. **Diagnosed and fixed the original onboarding bug** — a client-side race
   condition in `initAuth()` (two unsequenced `getSession()` +
   `onAuthStateChange` calls could resolve out of order and clobber fresh
   state with stale "no membership" results). Fixed with a single listener
   + generation-counter guard in `src/lib/auth/session.ts`.
2. **Fixed duplicate/orphan institute creation** — replaced a client-side
   check-then-insert with the atomic `create_institute_with_owner` RPC,
   backed by a DB-level unique index (one owner per user).
3. **Added `access_enabled`** per-member kill switch and its "Account
   Disabled" screen.
4. **Google OAuth → email/password** — Google sign-in first failed because
   `@lovable.dev/cloud-auth-js` redirected to `/~oauth/initiate`, a path only
   handled by Lovable Cloud's own hosting proxy (404'd on Vercel). Switched
   to Supabase's native Google OAuth, which then failed with "missing OAuth
   secret" (never configured in Supabase). Per your direction, replaced
   Google sign-in entirely with email/password to remove that whole
   category of external-config dependency.
5. **Backend/auth architecture audit** — `docs/backend-architecture.md`,
   covering the full stack, schema, RLS, and access model.
6. **Migration/seed verification** — confirmed 5 migrations existed, no
   seed file existed yet, `config.toml` existed.
7. **Supabase project cutover** — moved from the old, Lovable-managed
   project (`fqusjrsboyinbrblauma`, actually reached only through a Lovable
   Cloud proxy domain, not a direct Supabase URL) to a project the repo
   owner controls directly (`xrkfbsupszhsjevcmntc`). Full detail in
   `CUTOVER.md`.
8. **Found and fixed a critical, previously-undiscovered grant bug** —
   migration 2 revoked `EXECUTE` on `is_member`/`is_owner` from
   `authenticated` and nothing ever re-granted it, breaking every
   RLS-protected query for every real signed-in user since that migration.
   Confirmed by directly simulating an authenticated request against the
   live database, not inferred from reading SQL. This was very likely a
   second, independent root cause behind the original "always stuck on
   onboarding" symptom, on top of the client race condition in step 1.
9. **`supabase/seed.sql`, `SETUP.md`, `BACKUP.md`** added — demo data,
   zero-prior-knowledge setup guide, backup/restore guide. Seed script
   verified for real against the live project (ran it twice, confirmed
   genuinely idempotent, confirmed readable end-to-end under RLS as the
   demo owner).
10. **Merged in parallel work** — while this was happening, a "Bulk Student
    Import" feature and an independent `.env` cutover to the same project
    were pushed directly to `main` (via Lovable's editor). Merged cleanly.
11. **Caught and fixed a regression from that merge** — the auto-merge had
    silently regenerated `src/integrations/supabase/types.ts`, dropping
    `access_enabled` and `create_institute_with_owner` from the generated
    types, which cascaded into the disabled-account feature being silently
    removed from `session.ts` and an unsafe type-cast being added to
    `auth-gate.tsx` to paper over the resulting type error. Restored the
    correct types (verified against the real live schema) and the original,
    properly-typed logic.
12. **Wrote a CI migration-validation workflow** (not yet pushed — see
    **Manual Steps Remaining**).

## Session 2 (July 11–12, 2026) — five PRs, #1–#3 merged, #4 open

1. **PR #1 — PDF export `oklch()` crash + a leading-zero input bug.**
   `html2canvas` 1.4.1 couldn't parse the `oklch()` color function used
   throughout `src/styles.css`, breaking both receipt and admission-form
   PDF export. Swapped it for `html2canvas-pro` (API-compatible fork with
   `oklch()`/`oklab()`/`lab()`/`lch()`/`color()` support) — only the import
   and one `package.json` line changed. Also fixed a stray leading zero in
   the Capacity/Monthly fee inputs on the batch dialog (a classic React
   controlled-`type="number"` quirk: React skips re-syncing the DOM when
   the *parsed* value is unchanged, so `"016"` sticks around since it still
   parses to `16`) via a `sanitizeNumberInput()` helper. **Merged.**
2. **PR #2 — bulk import validation review.** Reviewed an updated
   `import-students-dialog.tsx` against a checklist (name-only rows,
   optional mobile, phone normalization, duplicate detection, TS
   strictness). Found one real regression: `isValidPhone` had been loosened
   to accept any 10-digit string (e.g. `0123456789`), dropping the
   `[6-9]` Indian-mobile-prefix check the previous version enforced.
   Restored it. **Merged.**
3. **PR #3 — batch fee & admission workflow simplification.** Batches now
   store one **Total Course Fee** instead of a Monthly Fee (migration
   renames + backfills `monthlyFee * 12`, matching what the app already
   assumed everywhere a course fee was derived from a batch). Student
   Admission auto-fills Course Fee from the selected batch, read-only by
   default with an explicit override toggle; Admission Fee now defaults to
   ₹0. Investigated *why* batch Start/End dates were effectively
   mandatory — turned out both were already nullable/unvalidated, but
   `fromBatch()` sent `''` straight into a Postgres `DATE` column, which
   errors on empty input; fixed by coercing to `null`. Fees screen renamed
   every "Pay" surface to "Receive Payment" (button, dialog title, success
   toast). WhatsApp acknowledgement template updated to the requested
   copy, and fixed the actual reason greetings could render blank: the old
   `?? "Parent"` fallback doesn't catch an empty string, and an empty
   string is exactly what a blank parent-name field produces. **Merged.**
4. **PR #4 — controlled editing for Students and Payments.** Added a ⋮
   overflow menu to Student and Payment rows: **Edit Student** (reopens the
   admission dialog pre-filled, now supports edit mode; added Roll Number
   and Date of Birth fields, the latter needing a new column) and
   **Archive Student** (reused the existing, previously-unexposed
   soft-delete/recycle-bin plumbing); **Edit Payment** (amount/date/mode/
   notes only) and **Void Payment** (a new status distinct from soft-delete
   — stays visible/searchable in history, only excluded from
   collected/outstanding totals). Along the way, found that
   `audit_logs` already existed as a real, RLS-protected table but the
   app's `logAudit()` had only ever written to browser `localStorage` —
   fixed it to also write through to the real table (old/new value JSONB
   snapshots included), benefiting every existing audit call site, not
   just the new ones. Owner/Admin-only permission requirement mapped to
   `owner`-only (no Admin tier exists — see **Pending tasks**); this
   gating is frontend-only, RLS was deliberately not tightened in this
   pass (see **Known Issues**). **Open, not yet merged** as of this
   writing.
5. **Mid-session integrity check**: partway through PR #4, found a full
   commit already sitting on that branch that I had no memory of creating.
   Rather than trust it, independently diffed and re-verified every file
   in it against `main` line-by-line before proceeding — which caught one
   real bug (a `date_of_birth` column referenced in code with no migration
   ever creating it) that's now fixed. Documented for whoever picks this
   up next: unexplained pre-existing state in a session should be verified
   from scratch, not assumed safe just because it looks plausible.

## Session 3 (July 13–18, 2026) — 15 commits, all pushed to `main`

Working session covering: historical-payment import, a real payment-flow
bug hunt, receipt contact overrides, multi-user Team Members, a dashboard
redesign, a new Batch Collection Report, and — running through most of
it — a recurring "different pages disagree on Collected/Due" bug that
took several passes to fully stamp out. In commit order:

1. **`f6d4d2f` — historical payment import.** Bulk student import already
   supported Paid Fee/Payment Date/Payment Mode/Description columns, but
   only wrote them onto the student's own `paid_fee` — it never created
   an actual row in `payments`, so Payment Timeline and receipt history
   stayed empty for imported students. Fixed by calling the same
   `recordPayment()` manual payments use, gated on `paidFee > 0`. Found
   and fixed a real timezone bug in the same file (`toISOString()` is
   UTC-based, rolls back a day for part of every IST day) and consolidated
   a private `todayLocalISO()` duplicate into the shared one in
   `lib/format.ts`.
2. **`30697b4` — Batch Fee Report.** New downloadable Excel report per
   batch (Student Name / Paid Fee / Remaining Fee, sorted by highest due).
   Reviewed and fixed the uploaded implementation before committing: it
   used `exceljs` where the repo already had `xlsx` — tested directly
   (wrote and inspected a real file) and confirmed `xlsx`'s free tier
   can't do frozen panes or cell styling, so kept `exceljs` deliberately,
   flagging the ~1MB bundle-size cost rather than silently accepting it.
3. **`4d50734` — selectable Payment Date on manual payments.** Receive
   Payment previously always stamped `new Date()`. Added a date field
   (defaults today, blocks future dates, inline + toast validation).
4. **`d1dd7b3` — receipt contact overrides.** Phone/Email/Website shown on
   receipts can now be overridden independently of the Institute tab,
   falling back live to the Institute tab's value when not overridden
   (`NULL` = fallback, never a copied value, so editing the Institute tab
   later automatically flows through). New migration + new
   `getEffectiveReceiptContact()` resolver used by both the Settings
   preview and the actual receipt render — one definition, not two.
5. **`d7c7967` — duplicate-receipt bug.** Repeated clicks on "Save &
   generate receipt" created multiple identical payments, because the
   button had no loading state or re-entrancy guard at all. Fixed with a
   `submitting` flag + disabled button, and added a same-day/same-amount/
   same-mode duplicate-payment warning (confirmable, not a hard block).
6. **`d798b0e` — two payment-flow bugs, root-caused rather than
   patched.** (a) Import still wasn't creating payment rows for
   historical payments in the *current* codebase state at the time (a
   regression check caught this had drifted) — reconfirmed the fix from
   commit 1. (b) "Save & Generate Receipt" sometimes showed an error
   toast even though the payment and receipt were both actually created.
   Traced the full call chain rather than guessing: `recordPayment()`
   inserts the payment (this *is* the receipt — there's no separate
   receipts-table write), then calls `reconcileStudentPaid()` to update
   the student's cached `paid_fee`. That reconcile step could throw for
   unrelated transient reasons *after* the payment had already durably
   committed, rejecting the whole `recordPayment()` promise and making a
   successful save look like a failure. Fixed by making
   `reconcileStudentPaid()` best-effort (log, don't throw) — it's derived
   cache maintenance, not the source of truth, so its failure must never
   be reported as the triggering mutation's failure. This one fix
   quietly repaired the same latent bug in `updatePayment`/`voidPayment`/
   `deletePayment`/`restorePayment` too, since they all share this helper.
7. **`ca77702` — Record Payment on Student Details did nothing.** The
   button existed but `RecordPaymentDialog` was a private component
   defined only inside `fees.tsx` — nothing was wired up. Extracted it
   into `src/components/record-payment-dialog.tsx` as the one shared
   implementation both pages now use. Also fixed Student Details' Fee
   Summary staying frozen after a payment recorded elsewhere: traced to
   `ensureQueryData`'s `revalidateIfStale: false` default serving a
   merely-*flagged*-stale cache entry with no real refetch — added an
   explicit forced refetch (later generalized, see commit 10).
8. **`a5cc8fa` → `e646f02` → `4e706b7` → `d24d651` — the "different pages
   disagree" bug, in four parts.** A screenshot showed Payment Timeline
   correctly listing a new payment while Student Details' Collected/Due
   still showed the old numbers. Root cause: several screens read
   `student.paidFee`, a column reconciled by the (now best-effort, see
   commit 6) background step — if that step ever fails silently for one
   student, that column drifts out of sync with the real `payments`
   table while everything reading `payments` directly stays correct.
   Fixed one screen at a time as each was reported/found, always the
   same way — derive Collected from a sum over that student's non-voided
   payments instead of trusting the cached column:
   - `a5cc8fa`: Student Details.
   - `e646f02`: Fees list + Batch Fee Report (`batches.tsx` now also
     loads `listPayments()`).
   - `4e706b7`: Dashboard + Student List (Student List didn't load
     payments at all before this).
   - `d24d651`: the individual receipt page (`receipts.$id.tsx`) — found
     by grepping for remaining `student.paidFee` reads after the
     Dashboard/Student List fix, then hit for real in production days
     later. This is the same bug fixed 3 separate times before it was
     caught everywhere it existed; see **Known Issues** for the
     confirmed-remaining spots (WhatsApp message content, the recovery
     page) that carry the identical risk but haven't been touched yet.
   - Alongside `4e706b7`: also widened `invalidateQueries()` to
     `{ refetchType: "all" }` at every payment-mutating call site
     (record/edit/void, bulk import, restore/purge from the Recycle
     Bin, which previously didn't invalidate any query cache at all) —
     the narrower, per-page `refetchQueries` fix from commit 7 is exactly
     the pattern that let this slip through repeatedly, since each new
     page needed its own manual wiring. A blanket refetch after any
     payment mutation needs zero wiring for whatever page comes next.
9. **`4227d40` — multi-user Team Members.** Integrated a feature built in
   a separate session that only had a handful of files to work from
   (schema/RPC/RLS migrations, `roles.ts`, `team/store.ts`,
   `team-members-section.tsx`). Two real bugs found and fixed before
   applying, not applied as uploaded:
   - The RLS migration's `DROP POLICY` statements referenced guessed
     policy names that don't match what the original schema migration
     actually named them — as written, the drops would have silently
     no-op'd and left the old, more permissive direct-write policies
     active, letting an owner bypass `invite_member`'s validation (5-seat
     cap, duplicate-invite check) by writing to `institute_members`
     directly. Fixed to drop the real policy names.
   - `getActorName()` (used to show a real name in Recent Activity
     instead of a raw value) was written to match a real user id, but
     the only thing actually available to it (`AuditLog.by`) is an email
     string (`adapter.ts`'s `currentUser()` returns `getSession().email`,
     not an id) — would never have resolved a single name. Fixed to
     match on either.
   Also completed the three integration tasks that session flagged as
   blocked: added the Team tab to Settings, wired `getActorName(l.by)`
   into Recent Activity (and `loadTeamMembers()` into `AuthGate` so the
   lookup has data), and updated Subscription pricing text to ₹5,999/year.
10. **`93f7410` — Dashboard redesign.** Reviewed the existing dashboard
    first: found the Collection Trend chart was genuinely broken
    (hardcoded `new Date("2025-11-01")` instead of the real date, plus a
    fabricated `Math.random()`-based series that wasn't even plotted),
    and found/removed a duplicate calculation (Top Pending Dues
    recomputed the same per-student paid/due/% math the new Follow-up
    card also needed — consolidated into one `withProgress` array).
    Replaced "New Admissions This Month" with a Collection Efficiency
    KPI and the Payment Modes pie chart with a configurable-threshold
    "Students Needing Follow-up" card. Total Students/Total Collection/
    Pending Fees are now clickable, opening drill-down modals (batch
    breakdown reuses the exact array already feeding the Revenue by
    Batch chart — no second calculation). No new Supabase queries.
11. **`0e0f5dc` — Batch Collection Report.** New, second, additive button
    per batch card: From/To date pickers (default to the current month)
    + "Download Collection Report" — a transaction-level export (one row
    per payment, no aggregation), distinct from the existing per-student
    Batch Fee Report. New adapter function
    `listPaymentsForBatchInRange()` queries only that batch's payments in
    that date range server-side (via `payments.student_id`'s existing FK
    to `students`), rather than fetching every institute payment and
    filtering client-side.
12. **`1cf9907` — batch fee changes weren't reaching enrolled students.**
    Reported directly: editing a batch's Total Course Fee from ₹40,000 to
    ₹48,000 updated the batch card but Students/Fees still showed
    ₹40,000 for its students. Root cause: `student.courseFee`/`totalFee`
    are copied from the batch once, at creation — independent columns,
    not a live reference. Fixed with a new Postgres function,
    `sync_batch_course_fee`, called from `updateBatch()` only when the
    fee actually changes. A DB function was necessary, not just
    convenient: `total_fee = new_fee + admission_fee` is a per-row
    expression (`admission_fee` differs per student) that a single
    client-side `.update()` call can't express.

Full architectural pattern that recurs through commits 6–10, worth
internalizing before touching payment/fee code again: **any student-
or-payment total shown in the UI must be computed live from the
`payments` table (or, for course fees, from the batch/student row
actually being edited) — never trusted from a cached column that some
background step maintains.** Every occurrence of this bug so far has
looked identical: one screen shows the right number (because it happens
to read `payments` directly), another shows a stale one (because it
reads a cache), and the fix is always to delete the cache read, not to
patch the cache.

---

## Session 4 (July 30–31, 2026) — Attendance + Expenses systems, 5 PRs merged (#6–#9, plus a docs update)

**Attendance system** (`20260730052621_attendance_system.sql`,
`20260730060000_revoke_public_anon_execute_attendance.sql`,
`20260730181401_attendance_notified_at.sql`):
- `attendance_sessions`/`attendance_absences` tables, `save_attendance`/
  `mark_attendance_status` RPCs. Both RPCs' `is_member()` guard and
  `save_attendance`'s cross-batch-id guard were tested live against
  production with real non-member/cross-batch calls (inside rolled-back
  transactions or against synthetic, immediately-deleted fixtures — never
  against real institute data), not just read from the SQL.
- First-pass grant check found `PUBLIC`/`anon` still had `EXECUTE` on both
  RPCs despite the SQL looking correct — caught via a direct
  `information_schema.routine_privileges` query, fixed by a follow-on
  migration. That follow-on migration itself wasn't committed as a file
  in this repo until this Session 4 docs pass (see Known Issues #22) —
  worth remembering as a case where "I fixed it live" and "it's actually
  in version control" turned out to be two different things.
- Mobile fixes (sticky save bar, controls bar, grid breakpoints), a
  Reports drill-down (`batches-overview.tsx` → `batch-day-list.tsx` →
  `day-notify-list.tsx`, replacing a flat date-range list), and a
  persistent WhatsApp "Notify" flow — `attendance_absences.notified_at`
  tracks send state server-side (not React state) so it survives a
  refresh or a different device; sent rows grey out and sink to the
  bottom rather than disappearing. A later pass added a top-level
  cross-batch "Notify" tab and restricted `day-notify-list.tsx`'s live
  send button to today's session only (past days show a read-only
  badge), a `mergeTemplates`/`resolveDefaults` fix so existing
  localStorage template state doesn't miss new built-ins, removal of two
  Reports summary cards, and a fix so deleted students' historical
  attendance stays visible in Reports/Notify while still correctly
  excluded from the live attendance-taking grid.

**Expenses system** (`20260731000000_expenses_system.sql`):
- Root cause of a real user-reported data-loss incident, investigated
  before any fix was proposed: `src/lib/expenses/store.ts` was entirely
  `localStorage`-only — confirmed by direct code trace (zero Supabase
  calls in the file) and a live `audit_logs` query (zero
  `entity='expense'` rows ever existed, so nothing was restorable
  server-side either).
- Replaced with `expenses`/`expense_categories` tables — same
  `is_member()` RLS and soft-delete convention as every other table,
  per-institute category seeding via a creation-time trigger (mirroring
  `add_creator_as_owner`) plus a one-time backfill for both existing
  institutes (24 categories each, confirmed via live query — an earlier
  verbal "should be 23" turned out to be an off-by-one hand-count, not a
  seeding bug). `category_id` uses `ON DELETE RESTRICT`, which required
  fixing a real latent bug: the old category-delete button was a
  synchronous, un-awaited, un-caught handler that would have shown a
  false-positive "Category deleted" success toast even if the new FK
  constraint rejected the delete.
- Two new `SECURITY DEFINER` RPCs, `get_profitability_summary` and
  `get_expense_breakdown_by_category`, replacing client-side
  revenue/expense math in `ProfitTab`. Verified live: one synthetic
  expense inserted and rolled back inside a transaction, RPC output
  matched an independent manual `SUM(payments)-SUM(expenses)` calculation
  exactly on all four returned figures, against real production payment
  data.
- This migration included `REVOKE ... FROM PUBLIC, anon` from the start
  (unlike the attendance migration's first pass, which needed a
  follow-on fix) — the standing rule this incident established is now
  documented explicitly in `docs/backend-architecture.md` §6.

**Also found and flagged, not fixed, during this session** (full detail
in Known Issues below): `audit_logs.entity = "category"` was dead code
until the Expenses system's category CRUD started actually writing it;
messaging templates remain localStorage-only; two `institutes` rows
share the identical name "Dnyanpeeth Classes," unresolved pending the
account owner's confirmation of intent.

---

# Known Issues
## Session 4 (July 30 – August 3, 2026) — 12 merged PRs (#6, #7, #8, #9, #11, #12, #13, #14, #15, #16, #18, plus this docs PR), 2 still open (#10, #17)

Working session covering two full new feature systems (Attendance,
Expenses), two rounds of mobile/UX auditing, a design-consistency pass
that was merged then reverted, and — the reason this document exists in
its current form — a docs-update effort that failed to land twice before
this attempt. In roughly chronological order:

1. **PR #6 — Attendance system, v1.** New two-table design
   (`attendance_sessions` + `attendance_absences`, absence-only storage —
   a present student generates zero writes), `save_attendance`/
   `mark_attendance_status` RPCs, present-by-default marking grid,
   holiday/cancelled-lecture states, bilingual (English/Marathi) WhatsApp
   absence templates, and a lock-window setting restricting edits after a
   configurable cutoff (owner/admin always exempt, enforced client-side).
2. **PR #7 — mobile fixes, Reports redesign, Notify list.** The v1 sticky
   save bar and controls row didn't wrap on phone-width viewports — fixed.
   Replaced a flat date-range report with a batch-first drill-down (batch
   cards → day list, newest-first, only days with an actual session → a
   per-day absentee list). Added a persistent, server-tracked
   (`notified_at`) WhatsApp notify list with sent/pending state that
   survives a refresh, sunk-to-bottom sorting for already-sent students.
3. **PR #8 — real bug found and fixed, not just described.** The
   messaging template store is `localStorage`-backed; any account active
   before the attendance category existed had a stale, non-empty
   persisted `templates` array that silently never picked up the new
   built-in absence templates — production report: "No attendance message
   template found." Root-caused precisely (the send-flow code filters
   `state.templates` by category directly, never reads the `defaults`
   map, so a merely-stale `defaults.attendance` pointer wasn't the actual
   failure path). Fixed with an additive `mergeTemplates()` that appends
   any built-in template missing from the persisted array by id, leaving
   edited/custom templates completely untouched — verified this
   specifically preserves user edits even when a built-in's default
   content later changes, by tracing the id-based filter logic, not just
   asserting it. Also: removed the two "Overall attendance"/"Lowest
   attendance" Reports cards (confirmed still present post-redesign, then
   removed per instruction), and fixed a real PRD-violating bug found
   while verifying deleted-student handling — the shared students query
   for the whole Attendance route excluded soft-deleted students, which
   meant a deleted student's *historical* absence rows silently vanished
   from Reports too, not just the live marking grid. Fixed by fetching
   the unfiltered list once and letting the live grid's own existing
   client-side filter continue to exclude them there only.
4. **PR #9 — Expenses & profitability system.** Migrated Expenses from
   in-memory-only to fully server-persisted (`expense_categories`,
   `expenses`), added a Profitability tab backed by a
   `getProfitabilitySummary` RPC (computes Net Profit server-side from
   real revenue minus real expenses) and `get_expense_breakdown_by_category`
   (defined and reachable, but no UI component currently calls its
   wrapping adapter function — see `KNOWN_ISSUES.md`).
5. **PRs #11–#12 — mobile/perf audit, round 1.** Sidebar and tap-target
   fixes, dialog font-size fixes, confirmed `staleTime`/route-`preload`
   tuning still intact, `exceljs` kept out of the shared bundle via its
   own lazy chunk (verified with real byte counts later in this session,
   not just re-asserted — see item 9 below), Settings tab-bar mobile
   scroll fix.
6. **PR #13 — header cleanup.** Removed a dead bell icon, fixed the
   account-dropdown-on-avatar interaction.
7. **PR #14, merged, then PR #15, reverted #14 ~10 minutes later.**
   A concurrent design-consistency-pass session's color/typography/
   border-thinning changes were merged, then reverted the same day —
   **documenting both**, not just the end state, since main's actual
   history genuinely contains both commits. The revert was confirmed
   clean: diffed every file PR #14 touched but this session's own work
   didn't, against the pre-#14 commit — byte-identical, confirming no
   partial/incomplete revert. PR #14's own description named one
   deliberately-deferred item — a spacing-token system, not introduced
   "per instruction" — now carried into `ROADMAP.md`/`KNOWN_ISSUES.md` in
   this docs update, since it never actually landed in either the first
   time despite PR #14's description saying it had.
8. **PR #16 — UI fixes batch 1.** Five items: removed a redundant
   Settings subtitle; removed a "FUTURE READY" info box from Fee Recovery
   that directly exposed an internal file path
   (`src/lib/messaging/whatsapp.ts`) and WhatsApp-provider-swap
   implementation notes to end users (context preserved in `ROADMAP.md`'s
   WhatsApp entry, not just deleted); investigated two existing list
   patterns in the app before touching Receipts (Students list = same
   flat `divide-y` problem, not a fix; Batches list = genuine per-item
   Cards) and restyled Receipts to match Batches' card tokens; a mobile
   zoom-bug investigation that found the *reported* dialog (Add Expense)
   had no actual font-size violation, but found and fixed a real,
   separate one in `recovery.tsx` (a `Textarea` with `text-xs`
   unconditionally overriding the safe `text-base md:text-sm` default);
   student card three-dot-menu repositioned to the top row next to
   name/avatar, bumped from a non-standard `h-8 w-8` to this app's actual
   established `h-11 w-11` row-action convention.
9. **Deploy/preview confusion, mid-session.** After PR #16 merged, a
   report that the receipts-card fix "wasn't showing" turned out to be a
   manual Vercel-dashboard rollback to a pre-#16 deployment (done to
   escape the disputed PR #14 styling, which inadvertently rolled back
   #16's genuinely-unrelated fixes along with it) — not a code bug.
   Confirmed via GitHub's Deployments API (not assumed): the correct
   commit had deployed successfully; the disputed PR #14 changes were
   independently confirmed byte-identical-to-reverted in files this
   session never touched. Real, measured evidence was gathered for a
   separately-reported perceived navigation-latency regression: bundle
   size before vs. after the whole Session 4 feature set moved by only
   +1.06% (56→58 chunks, 3,790,659→3,830,739 bytes) despite two entire
   new feature systems landing — no evidence of an eager-loading
   regression of the kind already found and fixed once for `exceljs`.
10. **PR #17, open, diagnostic-only, not to be merged regardless of
    outcome.** Investigating the Add Expense mobile zoom bug further:
    every other input in that dialog already checked out clean (see #8
    above), so as a targeted test, temporarily removed only the
    `type="file"` attachment field to isolate whether iOS Safari's native
    file-picker sheet interacting with the dialog's `position: fixed` +
    Radix scroll-lock is the trigger — an unconfirmed theory, never
    guessed into a permanent fix. Pushed to its own preview deployment
    with the exact URL called out explicitly, given the deploy-confusion
    in item 9. Result pending as of this document's writing.
11. **PR #18 — receipt card payment-mode badge reposition.** Moved from
    the date row to sit inline with the receipt number (top row,
    right-aligned) — receipt number identifies the transaction, payment
    mode describes it, a more natural pairing than badge+date. Same
    "identity + status grouped together at the top" principle as the
    student-card menu fix in PR #16. Proposed before implementing, same
    as that change.
12. **This docs update — third attempt.** PR #10 (opened 2026-08-01,
    covering Attendance+Expenses doc updates) and an earlier attempt
    before it both failed to land — **see the process note in Handover
    Notes** for why, and the recommendation to stop it recurring a third
    time.

Two items explicitly **not** resolved this session, tracked in
`KNOWN_ISSUES.md`: the Add Expense zoom bug (root cause still open,
pending PR #17's test result), and `get_expense_breakdown_by_category`'s
wrapping adapter function having no caller anywhere in the UI.

1. **CI workflow not yet on `main`.** `.github/workflows/validate-migrations.yml`
   was written and verified logically sound (spins up a real local Supabase
   stack via `supabase/setup-cli` and applies all migrations against it),
   but the push token available didn't have the `workflow` OAuth/PAT scope
   GitHub requires for pushing changes under `.github/workflows/`. It exists
   in this session's working copy but needs a properly-scoped token to land.
2. **Real HTTP-level auth flow was only partially verified by me directly** —
   I verified the database layer exhaustively (RLS, RPCs, triggers, grants)
   by simulating authenticated requests directly against Postgres, since
   this environment can't reach Supabase's Auth API over the network. The
   *real* end-to-end proof came from your own usage: a real account
   (`rajs13102003@gmail.com`) successfully created a real institute
   ("Dnyanpeeth Classes") through the actual deployed app. That's strong
   evidence the full flow works, but it was your testing, not an automated
   check in this repo — there's no automated end-to-end test suite.
3. **Two users, one institute** — `rajsakhare544@gmail.com` (the second
   account) exists but isn't a member of any institute yet. Not necessarily
   a bug (could be a second owner test that never went further), but worth
   checking if that's expected.
4. **No staff-invitation UI** (see **Pending tasks** above).
5. **`auth_leaked_password_protection` is disabled** on the Supabase
   project (flagged by Supabase's own security advisor) — HaveIBeenPwned
   checking on new passwords isn't enabled. Cheap to turn on, meaningful
   now that the app is email/password-only.
6. **Parallel-editing risk**: this session and Lovable's own editor both
   pushed to `main` concurrently at several points. It worked out (git
   merged cleanly, and I caught the one silent regression it caused), but
   it's a real risk pattern worth being deliberate about — ideally, one
   "driver" at a time.
7. **`.env` is committed to the repo.** Contains only the anon/publishable
   key and project URL (Supabase's own docs consider these safe to expose
   client-side; the service-role key is not present anywhere in the repo).
   Still not best practice — an `.env.example` + gitignoring the real
   `.env` would be cleaner. Flagged, not changed, in
   `docs/backend-architecture.md`.
8. **PRs #3 and #4's migrations are not applied to the live database yet.**
   Merging a PR only changes what's in `main` — it does not run
   `supabase db push` against the actual project. If the frontend from
   either PR is deployed before its migration runs, `batches`/`payments`/
   `students`/`audit_logs` writes will fail with a Postgres "column does
   not exist" error. See **Manual Steps Remaining**.
9. **Edit/Void permission gating is frontend-only** (PR #4). The RLS
   `UPDATE` policies on `students`/`payments` still allow any institute
   member, not just owners, to update either table. Not tightened in this
   pass on purpose: `reconcileStudentPaid` performs a `students` UPDATE
   (`paid_fee`) as a side effect of every payment a staff member records —
   a blanket owner-only policy would have broken staff's ability to record
   payments at all. Correctly restricting just the edit/void columns needs
   a column-aware `BEFORE UPDATE` trigger comparing OLD vs NEW, which is a
   larger, separate change.
10. **No "Admin" role tier exists** — only `owner`/`staff`. PR #4's "Owner
    and Admin only" requirement was mapped to `owner`-only pending a real
    product decision on whether a third tier is needed.
11. **Recycle Bin / Audit Log page still reads from `localStorage`**, not
    the database. PR #4 fixed `logAudit()` to *also* write through to the
    real `audit_logs` table (so entries are now durable and
    cross-device), but `recycle-bin.tsx`'s Audit Log tab still reads the
    old localStorage-backed `listLogs()` — so a different browser/device
    won't see the same audit history yet. Left this way deliberately to
    avoid a larger, riskier retrofit in the same pass; flagged as a
    follow-up.
12. **The leading-zero controlled-number-input bug** (fixed in
    `batches.tsx` in PR #1) still exists in `add-student-dialog.tsx`
    (course fee/admission fee/discount fields), `expenses.tsx`, and
    `settings.tsx` — same root cause, not yet applied there.
13. **`student.paidFee` is still read directly (not derived from the
    payments ledger) in three places, confirmed by grep after the
    Session 3 Dashboard/Student List fix**: the WhatsApp acknowledgement
    subtype/pending-amount logic (`payment-row-menu.tsx`,
    `lib/messaging/whatsapp.ts`) and the recovery/reminders page
    (`recovery.tsx`). Same latent-staleness risk as the bug fixed on
    five other screens this session (see Session 3, item 8) — flagged
    but not fixed, since each of these needs to start loading payment
    data it doesn't currently fetch, which is a real expansion beyond
    what was reported each time this came up. Fix the same way: sum that
    student's non-voided payments instead of trusting the cached column.
14. **The "Students Needing Follow-up" threshold (Dashboard) is
    session-only, not persisted.** Implemented as a plain Select on the
    card (20/30/40/50/60%, default 40%) rather than an institute setting,
    since adding a settings field + migration for one dashboard filter
    felt disproportionate to what was asked. Revisit if owners actually
    want their chosen threshold to persist across visits/devices.
15. **Team Members invite/role-change/remove is owner-only**, matching
    the product's own permission table exactly (Admin/Teacher/Accountant
    are all explicitly "cannot manage users" in the spec this was built
    from). An `is_owner_or_admin()` helper already exists in the RLS
    migration for future use if this is ever meant to include Admins —
    swapping `is_owner` for it in the three RPCs plus updating `can()` in
    `roles.ts` is a small, contained change if that decision is made.
16. **Every migration created in Session 3 needs to actually be applied
    to the live database** (`supabase db push`, or run manually in order
    via the SQL editor) — see **Manual Steps Remaining**. This bit
    directly during the session: a real "Couldn't load your account"
    error appeared in production because `institute_members.status`
    (added by one of these migrations) didn't exist yet on the live
    project. Migrations sitting in `supabase/migrations/` do nothing on
    their own.
17. **The GitHub PAT used to push throughout Session 3 was reused across
    essentially every push in the session** (same token pasted
    repeatedly rather than a fresh one each time) — flagged in-session
    multiple times. Treat it as fully exposed; rotate it before doing
    anything else with this repo if it hasn't been rotated already.
18. **Two `institutes` rows exist with the identical name "Dnyanpeeth
    Classes"** (`5577d52e-84da-4272-8f58-c621cf115c63` and
    `ca9b2db1-3a4d-4f38-ba97-f716598bb86b`) — found during the Expenses
    migration work (both got the same 24 default expense categories
    seeded, correctly, by the backfill). Not the same thing as item 3
    above (that's about a *user* with no institute; this is two separate
    *institute* rows with the same display name). Not touched or acted
    on — needs the account owner to confirm whether this is intentional
    before anyone merges, deletes, or modifies either row.
19. **Messaging templates (`src/lib/messaging/store.ts`) are still
    localStorage-only**, not Supabase-backed. A `mergeTemplates`/
    `resolveDefaults` fix was added during the Attendance build so
    existing localStorage state picks up new built-in templates (e.g. the
    attendance category) without losing user edits, but the underlying
    storage is still local, not server-side/cross-device. Same class of
    risk that caused item 21 below — not yet fixed.
20. **`audit_logs.entity = "category"`** was defined in the `AuditEntity`
    type union from early on but was genuinely never written anywhere —
    confirmed via a live query returning zero `entity='category'` rows
    (in fact, before the Expenses system shipped, `audit_logs` had exactly
    6 rows total, all `entity='attendance'`). As of the Expenses system,
    this path is now real: `addExpenseCategory`/`renameExpenseCategory`/
    `toggleExpenseCategory`/`deleteExpenseCategory` in
    `src/lib/data/adapter.ts` do call `logAudit({ entity: "category", ... })`.
21. **Expenses were entirely client-side `localStorage`
    (`src/lib/expenses/store.ts`/`defaults.ts`) until the Expenses system
    shipped** — confirmed as the real root cause of a user-reported
    data-loss incident (previously-entered expense data appeared to
    vanish). Confirmed via direct code trace (zero Supabase calls
    anywhere in the old store — only `logAudit()` calls, none of which
    ever passed a full record snapshot) and a live `audit_logs` query
    (zero `entity='expense'` rows ever existed, so nothing was
    restorable server-side either). Both files are now deleted; expenses
    are fully server-persisted (`expenses`/`expense_categories` tables,
    same RLS/soft-delete convention as every other financial table). See
    `docs/backend-architecture.md` §9 for the full technical writeup.
22. **The `REVOKE ... FROM PUBLIC, anon` fix for `save_attendance`/
    `mark_attendance_status`** was applied directly to production during
    the Attendance build but wasn't committed as a migration file until
    this documentation pass —
    `20260730060000_revoke_public_anon_execute_attendance.sql` now closes
    that gap. Applying it again against the already-patched live database
    is a safe no-op.

---

# Important Decisions

- **Email/password over OAuth.** Google OAuth broke twice for
  environment-specific reasons unrelated to the app's own logic (a
  Lovable-hosted broker path, then a missing Supabase provider secret). You
  made the call to drop OAuth entirely rather than keep fighting external
  configuration — this removes a whole category of "works here, not there"
  bugs, at the cost of the one-click convenience OAuth offers. Reasonable
  tradeoff for getting a stable v1 shipped; OAuth can be added back later as
  an *additional* option without conflicting with email/password.
- **Atomic RPC over check-then-insert for institute creation.** A
  client-side "check if a membership exists, then insert" had a real race
  window (two fast/duplicate submissions could both pass the check). Moved
  the whole operation into one `SECURITY DEFINER` Postgres function, backed
  by a unique index as the actual guarantee — the RPC is a convenience/UX
  layer, the unique index is what makes duplication structurally
  impossible even under concurrency.
- **One owner per user (unique index), not one owner per institute only.**
  Chosen specifically to make the original duplicate-institute race
  impossible at the data layer. Tradeoff: a user can't currently own two
  institutes. If multi-institute ownership becomes a real requirement,
  this index needs to be reconsidered together with an institute-switcher
  UI — not a quick change, a real design decision.
- **`access_enabled` as a separate concept from `subscription_status`.**
  Deliberately kept as two independent gates: `subscription_status` is
  institute-wide (billing-driven), `access_enabled` is per-member (an
  owner disabling one specific person). Conflating them would make it
  impossible to disable one abusive staff member without also locking out
  the whole institute.
- **Cutting over to a self-owned Supabase project.** The original project
  was reachable only through a Lovable Cloud proxy domain, not a direct
  Supabase URL — meaning the repo owner likely couldn't administer it
  directly (rotate keys, view logs, configure auth settings) even though
  the app depended on it. Confirmed no production data existed, so this was
  a clean cut, not a data migration.
- **Fixing the grant bug as a new migration, not a manual one-off patch.**
  Applied directly to the live project *and* committed to
  `supabase/migrations/`, so a fresh project built from this repo's
  migrations from scratch won't reintroduce the same bug. Consistent with
  "schema as code" — the live database and the committed migrations should
  never silently diverge.
- **Seed script requires real UUIDs, doesn't create fake Auth users.**
  Directly inserting into `auth.users`/`auth.identities` is a common seed
  pattern but is fragile across Supabase/GoTrue versions — a slightly wrong
  column can produce an account that exists but can't sign in. Chose
  correctness over one-command convenience: `seed.sql` fails fast with a
  clear error if you haven't substituted real UUIDs first.
- **`html2canvas-pro` over patching colors.** Rather than stripping/
  rewriting `oklch()` colors before every PDF export (fragile, has to be
  kept in sync with the theme forever), swapped the rendering library for
  one that already understands modern CSS color functions. One-line
  dependency swap vs. an ongoing maintenance burden.
- **Batches store Total Course Fee, not Monthly Fee.** The app already
  multiplied `monthlyFee * 12` everywhere it needed a course fee — this
  just moves that computation from "every call site, forever" to "once,
  at migration time," and lets a batch's fee stop assuming every course is
  exactly 12 months.
- **Void ≠ soft-delete for payments.** Soft-delete (`deleted`) hides a
  record in the Recycle Bin. A voided payment needs the opposite
  visibility: stay in normal payment history, stay searchable, just stop
  counting toward money totals. Reusing `deleted` for this would have
  hidden voided payments from the exact place they need to remain visible
  — so it got its own `voided`/`voided_at`/`voided_by` columns instead.
- **Owner/Admin → owner-only, not a new role tier.** Building a real
  "Admin" role would touch RLS policies, the invite flow, and the
  settings/team UI — a bigger, separate change than this task's scope.
  Mapped the requirement to the closest existing tier (`owner`) rather
  than either silently under-scoping the requirement or unilaterally
  expanding the role model.
- **Fixed `logAudit()` globally, not just for the new actions.** The
  `audit_logs` table and its RLS already existed — `logAudit()` just never
  wrote to it. Rather than build a second, parallel "real" audit path only
  for the new Edit/Void actions (leaving every other existing audit call
  silently broken), fixed the one shared function so every audit event,
  old and new, is now durable. Kept the existing localStorage write too,
  so the Recycle Bin/Audit Log page keeps working without its own
  migration in the same pass.

---

# Manual Steps Remaining

These genuinely cannot be done from within this repo/session:

1. **Push the CI workflow** — needs a GitHub token with the `workflow`
   scope (classic PAT: check the `workflow` box; fine-grained PAT: add
   "Workflows: Read and write" permission). The file is ready; it just
   needs pushing.
2. **Confirm Vercel's environment variables** match the block in
   **Deployment** above, and redeploy if they don't.
3. **Supabase dashboard settings** on the new project:
   - Authentication → Providers → Email: confirm enabled, decide "Confirm
     email" on/off.
   - Authentication → URL Configuration: set Site URL + Redirect URLs to
     your real Vercel domain(s).
   - Consider enabling "Leaked password protection" (flagged above).
4. **Decide what to do about `rajsakhare544@gmail.com`** (the
   institute-less second account) — nothing automated should touch this
   without knowing whether it's intentional test data or something you
   still need.
5. **Rotate any GitHub PAT that was pasted into chat** during this session,
   if that hasn't already been done — standard hygiene after using a token
   conversationally.
6. **Apply the two new migrations to the live database** —
   `20260711130000_batch_total_course_fee` and
   `20260711140000_payment_void_and_audit_diffs` are committed but not run
   against the live project. Either `supabase db push`, or run the two
   files' SQL manually via the Supabase SQL editor, in that order.
   Frontend code from PR #3/#4 will error on writes until this is done.
7. **Review and merge (or request changes on) PR #4**
   (`feat/controlled-student-payment-editing`) — open as of this writing.
8. **Rotate the GitHub PAT again** — it was reused across multiple pushes
   in this session (same token pasted repeatedly rather than a fresh one
   each time). Treat it as fully exposed and rotate it.

### Session 3 additions

9. **Apply four new migrations to the live database, in order** — none
   of them have been run against the live project yet:
   - `20260713080000_add_receipt_contact_overrides.sql`
   - `20260714120000_team_members_schema.sql`
   - `20260714120001_team_members_rpcs_and_rls.sql`
   - `20260718090000_sync_batch_course_fee.sql`
   Either `supabase db push`, or run each file's SQL manually via the
   Supabase SQL editor in the order listed. This is not hypothetical —
   the `institute_members.status` column from the Team Members schema
   migration not existing yet on the live project caused a real
   "Couldn't load your account" error in production mid-session (see
   Known Issues, item 16).
10. **Rotate the GitHub PAT yet again** — reused across essentially every
    push in Session 3, the same way as Session 2. If you take one action
    from this document before anything else, make it this one.
11. **Decide whether Admin should also be able to manage Team Members**
    (currently owner-only, matching the spec exactly) — see Known
    Issues, item 15, for the one-line change if the answer is yes.
12. **Decide whether the Follow-up threshold (Dashboard) should persist**
    per-institute instead of resetting every session — see Known Issues,
    item 14.
13. **Decide whether to fix the three remaining `student.paidFee`
    reads** (WhatsApp messages, recovery page) the same way the other
    five screens were fixed this session — see Known Issues, item 13.

---

# Next Recommended Tasks

Roughly in priority order:

1. Push the CI workflow (5 minutes, just needs the right token).
2. ~~Build a staff-invitation UI~~ — done in Session 3 (Team Members).
3. Enable leaked-password protection in Supabase Auth settings.
4. Decide the fate of the second, institute-less test account.
5. Consider adding automated end-to-end tests (sign-up → onboarding →
   dashboard) now that the flow is stable — this session's verification
   was thorough at the database layer and confirmed once by real manual
   testing, but there's no repeatable automated check yet.
6. Revisit the "one owner per user" constraint if multi-institute ownership
   is ever a real requirement — needs a design pass, not a quick migration.
7. Move `.env` out of version control in favor of `.env.example` +
   `.gitignore`, for normal hygiene (low urgency — nothing in it is
   actually secret today).
8. Apply the Session 3 migrations to the live database (see **Manual
   Steps Remaining**, item 9) — highest-priority item below the CI
   workflow, since features already shipped to `main` depend on them.
9. Retrofit RLS on `students`/`payments` with a column-aware
   `BEFORE UPDATE` trigger so Edit/Void is actually enforced server-side
   for non-owners, not just hidden in the UI.
10. Decide whether a real "Admin" role tier needs elevated permissions
    beyond what Team Members already gives it (currently: operational
    access, no user/subscription management — see Known Issues, item 15).
11. Migrate the Recycle Bin / Audit Log page to read from the database
    instead of `localStorage`, now that `audit_logs` is actually being
    written to.
12. Apply the same leading-zero controlled-number-input fix from
    `batches.tsx` to `add-student-dialog.tsx`, `expenses.tsx`, and
    `settings.tsx`.
13. Fix the three remaining `student.paidFee` reads (WhatsApp message
    content, recovery page) the same way as the other five screens this
    session — see Known Issues, item 13.
14. Decide whether the Follow-up threshold should persist per-institute
    — see Known Issues, item 14.

---

# Testing Status

### Verified
- Full schema/RLS/trigger/grant correctness — directly simulated against
  the live `xrkfbsupszhsjevcmntc` project (not inferred from reading SQL):
  sign-up → `create_institute_with_owner` → membership read-back under
  RLS → institute read-back, all as the exact authenticated role PostgREST
  uses in production.
  - Idempotency: calling the creation RPC twice as the same user does not
    create a duplicate institute.
  - Tenant isolation: an unrelated user sees zero rows for another user's
    institute/membership.
  - The grant-bug fix: reproduced the failure before the fix, confirmed it
    resolved after.
- `seed.sql`: ran twice against the live project, confirmed idempotent,
  confirmed the resulting data is readable end-to-end under RLS as the
  demo owner.
- `tsc --noEmit`, `eslint` (on every file touched this session), and a full
  `vite build` all pass clean as of the latest commit on `main`.
- **Real-world confirmation**: an actual account
  (`rajs13102003@gmail.com`) successfully signed up and created a real
  institute through the live, deployed app.

### Still requires manual testing
- The disabled-account screen (`access_enabled = false`) — logic verified
  at the SQL level, but not clicked through in a real browser session.
- Subscription-status screens (`expired`/`blocked`) — same: logic exists
  and was reviewed, not manually clicked through recently.
- Sign-out → sign-back-in flow, and page-refresh persistence, in a real
  browser.
- The bulk student import feature (added in parallel by Lovable's editor,
  not something I wrote or tested this session).
- Cross-browser/mobile rendering of the auth screens — no visual QA was
  done this session.

### Session 2 verification
This sandbox has no live database connection and no headless browser, so
verification for PRs #1–#4 was: `tsc --noEmit`, `eslint` (confirmed zero
*new* errors on every touched file by diffing against the pre-change lint
output, not just eyeballing counts), and `vite build`, every time. For
PDF export specifically, no actual visual check of a rendered PDF was
possible — flagged explicitly in that PR rather than claimed as done.
Fee-calculation and WhatsApp-template logic were additionally verified
with standalone `tsx` scripts exercising the actual parsing/validation/
rendering functions against constructed test cases (name-only rows,
various phone formats, missing/blank parent names, etc.) — real code
paths, not the live app. **None of PRs #1–#4 have been manually
clicked-through in a live deployed instance by me** — that verification,
plus the actual database migrations, is the next owner's job (see
**Manual Steps Remaining**).

### Session 3 verification
Same constraint as Session 2 — no live database connection, no headless
browser, from this environment. Every commit's floor was: `tsc --noEmit`
clean, `eslint` showing zero *new* findings on every touched file
(verified by diffing the actual finding content against each file's
pre-change baseline, not just comparing totals — a lower or higher total
count alone doesn't prove nothing new was introduced), and a full `vite
build`. New SQL (4 migrations) was verified by direct code reading against
the actual live schema (checked real policy/function/column names via
`git`, not assumed) rather than run — none of it has been executed
against the live project (see **Manual Steps Remaining**, item 9).

Two bugs in this session were confirmed for real, not just reasoned
about: the duplicate-receipt bug (screenshot showing 7 identical
receipts) and the batch-fee-not-propagating bug (screenshot showing the
batch card's new fee next to Students/Fees still showing the old one) —
both reported with evidence, diagnosed against the actual code, fixed,
then the fix verified against the same evidence trail rather than
assumed correct from the diagnosis alone. The Dashboard/Student
List/receipt-page "stale Collected" bug was instead *predicted* (found by
grep after fixing the first few screens) before it was reported, and the
prediction turned out correct when it did surface in production days
later — worth noting as a case where proactively grepping for a bug
pattern found something a report hadn't yet surfaced.

---

# Handover Notes

- **This session had no memory of prior sessions** — everything above was
  reconstructed by directly reading the actual repo, actual live database,
  and actual conversation history, not from an assumed prior state. If a
  future session (Claude or human) is handed only this document, the repo
  and the live Supabase project are the sources of truth — this document
  is a summary of them, not a replacement.
- **An earlier uploaded `HANDOVER.md`** (from a different, more constrained
  session that only had URL-fetch access) described the old project as
  fully inaccessible and proposed a full re-verification of "unverified"
  file contents. That session's constraints don't apply here — this
  session had direct git and Supabase MCP access throughout, and everything
  in this document has been verified directly, not assumed.
- **If you're a future Claude session picking this up**: don't trust a
  prior handover doc's claims about your own tool access or session
  limitations — verify directly (clone the repo, query the live project)
  before acting on anything infrastructure-related, the same way this
  session verified rather than assumed.
- **If you're a human developer picking this up**: read `SETUP.md` first
  if you're setting up a fresh environment, `docs/backend-architecture.md`
  for how the whole system fits together, `CUTOVER.md` for why the Supabase
  project changed, and this document for where things stand right now.
- **Watch for concurrent edits.** If you're using Lovable's editor and
  also handing tasks to a Claude session (or another tool) with direct git
  access at the same time, expect merge conflicts and — as happened this
  session — the possibility of one side's auto-tooling silently
  regenerating a file (like `types.ts`) and quietly dropping something the
  other side added. Diff carefully after any merge involving generated
  files.
- **This environment (Session 3) had no live database or browser access
  either** — same constraint as Session 2, worth restating since it
  shaped how everything was verified (see **Testing Status**). If you're
  a future session with real Supabase/browser access, use it — actually
  clicking through the flows and applying the four pending migrations
  (Manual Steps Remaining, item 9) is real, higher-confidence
  verification than anything this session could do.
- **If you're picking up right where Session 3 left off**: the four
  migrations it added are not yet applied to the live database (Manual
  Steps Remaining, item 9) — this already caused one real production
  error mid-session (Known Issues, item 16) before it was diagnosed.
  Apply them before assuming any Session 3 feature (receipt contact
  overrides, Team Members, batch-fee-change propagation) actually works
  end to end.
- **The "different pages disagree on a total" bug pattern recurred
  multiple times in Session 3** before it was fully found everywhere it
  lived (see Session 3, item 8, and Known Issues, item 13 for the three
  confirmed spots still not fixed). If you're asked to fix a similar
  symptom again, grep for `student.paidFee` first — don't assume the
  prior fixes caught every occurrence.
- **Unexplained pre-existing sandbox state should never be trusted by
  default.** Twice in Session 2, this environment contained changes
  (once an uncommitted migration file, once a full commit) that neither
  session recalled creating, that happened to closely match the task at
  hand. Both times, the safe response was the same: don't build on it or
  push it unreviewed — independently verify or rewrite it, line by line,
  against the actual requirement before trusting it. If you're a future
  session and something in the working tree looks suspiciously
  convenient, treat that as a reason to double-check, not a reason to
  relax.
- **This document has now failed to get updated alongside its own
  feature PRs twice** before finally landing here — PR #10 (opened
  2026-08-01, covering Attendance + Expenses) sat open and unmerged for
  over a day while feature work kept shipping past it, and at least one
  earlier attempt before that also didn't land. Both times, the actual
  cause was the same: docs were filed as a separate PR, competing for
  review attention against faster-moving feature PRs, and lost. **Bundle
  doc updates into the same PR as the feature they describe, rather than
  filing them separately after the fact** — a PR that changes both
  `attendance.tsx` and `HANDOVER.md` gets reviewed and merged as one
  unit; a docs-only PR filed a day later has nothing forcing it to get
  attention before the next three feature PRs bury it. If you're a future
  session adding a feature, update these four files in the *same* branch,
  not as a follow-up task.
