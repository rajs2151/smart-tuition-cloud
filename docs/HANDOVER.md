# Project Handover

_Last updated: July 10, 2026_

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

### Features under development
- None actively in progress as of this handover — the most recent work
  (this session) was infrastructure/auth stabilization and a bulk student
  import feature, both now merged to `main`.

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
purpose) is in `docs/backend-architecture.md` §5. 6 migrations currently
applied, in order:

```
20260703064918_179279b9-...  initial schema
20260703064947_7e831c27-...  revoke_public_execute_on_helpers (see Known Issues — this is what later broke things)
20260707084455_feb25cb6-...  wire owner-membership trigger + backfill
20260707085440_be05dcf2-...  add subscription_status
20260707120000_fix_onboarding_race_and_access_control  atomic institute creation RPC, access_enabled, one-owner-per-user unique index
20260709055109_fix_authenticated_execute_grants        fixes the grant bug from migration 2
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
