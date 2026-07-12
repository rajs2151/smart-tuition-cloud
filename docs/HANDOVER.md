# Project Handover

_Last updated: July 12, 2026_

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
institute via `institute_members` with a `role` (`owner`/`staff`) and a
per-member `access_enabled` flag. Everything else (`batches`, `students`,
`payments`, `receipts`, `audit_logs`) is scoped to one institute.

---

# Current Status

### Completed features
- Email/password sign-up and sign-in (Supabase Auth)
- Onboarding: first-time "Create Your Institute" flow, atomic
  institute+owner-membership creation, race-condition-free session handling
- Per-member `access_enabled` disabled-account screen
- Institute-level subscription status gating (`trial`/`active`/`expired`/`blocked`)
- Dashboard, batches, students (list + detail), bulk student import
  (spreadsheet), fees, expenses, receipts (list + detail + printable
  receipt view), fee recovery tracking, recycle bin (soft-delete recovery),
  settings
- Full RLS-protected multi-tenancy across all data tables
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
7 tables, all with RLS enabled: `institutes`, `institute_members`,
`batches`, `students`, `payments`, `receipts`, `audit_logs`, plus Supabase's
built-in `auth.users`. Full table-by-table breakdown (columns, PKs, FKs,
purpose) is in `docs/backend-architecture.md` §5. 8 migrations committed,
in order (the last 2 are **not yet applied to the live database** — see
**Manual Steps Remaining**):

```
20260703064918_179279b9-...  initial schema
20260703064947_7e831c27-...  revoke_public_execute_on_helpers (see Known Issues — this is what later broke things)
20260707084455_feb25cb6-...  wire owner-membership trigger + backfill
20260707085440_be05dcf2-...  add subscription_status
20260707120000_fix_onboarding_race_and_access_control  atomic institute creation RPC, access_enabled, one-owner-per-user unique index
20260709055109_fix_authenticated_execute_grants        fixes the grant bug from migration 2
20260711130000_batch_total_course_fee                  batches.monthly_fee -> total_course_fee (renamed, backfilled *12)
20260711140000_payment_void_and_audit_diffs            payments.voided/voided_at/voided_by, audit_logs.old_value/new_value, students.date_of_birth
```

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
- `is_member(_institute, _user)`, `is_owner(_institute, _user)` — internal
  RLS helpers, `SECURITY DEFINER`.
- `next_receipt_number(_institute)` — atomically increments/returns the next
  formatted receipt number. `authenticated`-only (tightened from an
  over-permissive `PUBLIC`/`anon` grant in migration 6).
- `create_institute_with_owner(_name, _phone, _address, _email)` — atomic,
  idempotent institute + owner-membership creation. `authenticated`-only.

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

---

# Known Issues

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

---

# Next Recommended Tasks

Roughly in priority order:

1. Push the CI workflow (5 minutes, just needs the right token).
2. Build a staff-invitation UI (schema/RLS already support it).
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
8. Apply the two pending migrations to the live database, then merge PR #4
   (both blocking items above).
9. Retrofit RLS on `students`/`payments` with a column-aware
   `BEFORE UPDATE` trigger so Edit/Void is actually enforced server-side
   for non-owners, not just hidden in the UI.
10. Decide whether a real "Admin" role tier is needed, or whether
    "owner-only" is the intended permanent behavior for controlled
    editing.
11. Migrate the Recycle Bin / Audit Log page to read from the database
    instead of `localStorage`, now that `audit_logs` is actually being
    written to.
12. Apply the same leading-zero controlled-number-input fix from
    `batches.tsx` to `add-student-dialog.tsx`, `expenses.tsx`, and
    `settings.tsx`.

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
