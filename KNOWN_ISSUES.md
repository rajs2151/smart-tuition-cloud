# Known Issues

## Process Note: "No Textual Conflict" Isn't the Same as "Coherent Merge"

Status:
Resolved, but worth keeping as a process note so it isn't repeated

Notes:
PR #10 (opened 2026-08-01) and this repo's own PR #19 (2026-08-03) both
independently edited `docs/HANDOVER.md`, `CHANGELOG.md`, and
`ROADMAP.md` — long-diverged branches, same files. GitHub merged both
with no reported textual conflict, but the automatic result was still
genuinely broken: two contradictory "Last updated" lines and two
separate "Session 4" sections in `HANDOVER.md` (one structurally split
by a misplaced heading landing mid-section), a duplicate entry sitting
out of chronological order at the top of `CHANGELOG.md`, and two literal
duplicate checkbox lines plus a misplaced sub-bullet in `ROADMAP.md`.
Caught only because someone asked to independently re-verify the merged
result against the original diffs, not because GitHub flagged anything.
**When merging two branches that both touch the same docs files, treat
"no conflict reported" as necessary, not sufficient — diff the actual
post-merge content against both source branches before trusting it,
the same way code changes get reviewed.** See `docs/HANDOVER.md`'s
Handover Notes for the full incident writeup.

---

## Login / Onboarding

Status:
Resolved

Notes:
Was caused by two independent, stacked bugs: a client-side race condition
in session initialization (fixed 2026-07-07), and a database grant bug
that broke every RLS-protected query for real signed-in users (fixed
2026-07-09, see `CHANGELOG.md` for both). Confirmed working via a real
account creating a real institute through the live deployed app.

---

## Google Sign-In

Status:
Resolved (removed)

Notes:
Failed twice for infrastructure reasons unrelated to the app itself — a
Lovable-hosted OAuth broker path that only exists on Lovable Cloud's own
hosting, then a missing OAuth provider secret in Supabase. Replaced
entirely with email/password sign-in on 2026-07-08. Could be reintroduced
later as an *additional* option once Google Cloud Console credentials are
actually configured, if wanted.

---

## PDF Export (Receipts / Admission Form)

Status:
Resolved

Notes:
`src/lib/pdf/export.ts` renders a DOM element to canvas via html2canvas
before writing it into a PDF via `jsPDF`. The app's entire theme
(`src/styles.css`) defines colors using the modern CSS `oklch()` function —
79 separate uses across backgrounds, text, borders, and shadows — which
`html2canvas` 1.4.1's color parser does not understand (or `oklab()`/
`color-mix()`), and would either throw
(`Attempting to parse an unsupported color function "oklch"`) or silently
mis-render colors. Affected both call sites: receipt PDF export
(`src/routes/receipts.$id.tsx`) and admission form PDF export
(`src/routes/students.$id.tsx`).

Fixed by switching the dependency from `html2canvas` to `html2canvas-pro`
(a maintained, API-compatible fork that adds parsing for `color()`,
`lab()`, `lch()`, `oklab()`, and `oklch()`) — only the import in
`src/lib/pdf/export.ts` and the `package.json` dependency changed, no
call-site code. Verified: `tsc --noEmit`, `eslint`, and `vite build` all
pass clean with the new dependency resolved and bundled. Not verified:
an actual visual/pixel check of an exported PDF in a real browser (this
environment has no headless browser available) — recommend a quick manual
export-and-open check on both the receipt and admission-form PDFs before
calling this fully closed end-to-end.

---

## Add Expense Mobile Zoom Bug

Status:
Fix on main (2026-08-09) — still needs a real phone confirmation

Issue:
Reported: Expenses on mobile leaves the page zoomed out/misaligned,
persisting after closing dialogs / switching tabs until manually reset.

Root causes identified in audit (stacked, not mutually exclusive):
1. **Horizontal overflow from the 5-tab Expenses `TabsList`** (strongest
   match for "zooms out") — `expenses.tsx` used a non-wrapping
   `inline-flex` tab bar with no `overflow-x-auto`, unlike Settings which
   already fixed this pattern. Wide content forces mobile browsers to
   shrink the visual viewport.
2. **`SelectTrigger` hardcoded `text-sm` (14px)** in
   `src/components/ui/select.tsx` — ExpenseDialog uses it twice; iOS may
   auto-zoom on focus for sub-16px controls.
3. **`Input` `file:text-sm` (14px)** on the attachment field — same class
   of sub-16px violation as (2).

Fixes confirmed on `main`: scrollable Expenses tabs (`overflow-x-auto`);
`text-base md:text-sm` on `SelectTrigger`; `file:text-base md:file:text-sm`
on `Input`. Still needs a real phone confirmation before closing.

---

## `get_expense_breakdown_by_category` — Was Unused, Now Wired

Status:
Resolved (Expenses Dashboard uses it)

Notes:
`DashboardTab` in `expenses.tsx` now calls
`getExpenseBreakdownByCategory()` via React Query. The earlier "dead
code" finding is obsolete.

---

## Categories Tab: Switch Tap-Target and Label Gaps

Status:
Partially fixed (2026-08-09) — aria-label added; visual control still `h-5 w-9`
but hit area already expanded via `-m-3 p-3` wrapper

Issue:
The category active/inactive `<Switch>` in Expenses → Categories
(`src/routes/expenses.tsx`) is `h-5 w-9` (20×36px) via the shared
`Switch` component. An `aria-label` is now set so screen readers announce
which category is toggled. Enlarging the shared Switch globally was
deferred to avoid visual churn across Settings; the padded wrapper keeps
the tap target usable.

---

## Two "Dnyanpeeth Classes" Institute Rows (Reported, Unverified)

Status:
Reported, not independently confirmed — no database access available to
this session to check directly

Issue:
Flagged as a possible duplicate-institute-row issue for the demo/test
institute ("Dnyanpeeth Classes"). Every session working on this repo
recently has had git/API access only, no direct Supabase query access —
this needs confirming against the live `institutes` table by someone
with database access before treating it as confirmed. Not dismissing it,
just precise about what's actually been verified versus reported.

---

## Deferred: Spacing-Token System

Status:
Intentionally deferred, not a bug

Issue:
The design-consistency audit (PR #14, merged then reverted same day —
see `docs/HANDOVER.md` Session 4) found spacing inconsistencies across
the app but was explicitly instructed not to introduce a spacing-token
system as part of that pass. PR #14's own description said this had been
"documented as a deferred future item in both `KNOWN_ISSUES.md` and
`ROADMAP.md`" — checked, and it hadn't actually landed in either file
until now. Tracking it here for real this time; see `ROADMAP.md`.

---

## CI Migration-Validation Workflow

Status:
Restored on `fix/known-issues-open` — pending merge to `main`

Issue:
The file was added in `2cbbe90` then **deleted** in `bc3b3c4` because the
session token lacked GitHub `workflow` scope. `KNOWN_ISSUES.md` previously
claimed it "exists locally"; as of 2026-08-14 it was on neither disk nor
`origin/main`. Restored as `.github/workflows/validate-migrations.yml`
with the table-existence check updated for attendance, expenses, and
messaging tables. Landing on a feature branch so you can merge with a
token that allows `.github/workflows/` if GitHub still requires it.

---

## Staff Invitations

Status:
Resolved (Session 3, 2026-07-14/15)

Notes:
Built as multi-user **Team Members** — owner/admin/teacher/accountant
roles, invite by email, 5-seat cap (pending + active counted together),
pending invites auto-link to the real account on first sign-in
(provider-agnostic, keyed on `auth.users.email`). Invite/change-role/
remove are owner-only, matching the product's permission table exactly.
See `docs/HANDOVER.md` Session 3 for the two real bugs found and fixed
before this was applied (wrong RLS policy names, `getActorName()`
matching the wrong field).

---

## Leaked Password Protection

Status:
Pending

Issue:
Disabled in the Supabase project's Auth settings (flagged by Supabase's own
security advisor). Cheap to enable, meaningful now that the app is
email/password-only — checks new passwords against HaveIBeenPwned.org.

---

## Second Test Account With No Institute

Status:
Needs decision

Issue:
Two real accounts exist on the live project
(`rajs13102003@gmail.com`, `rajsakhare544@gmail.com`), but only the first
has created an institute. Not necessarily a bug — could be intentional
testing — but flagged since nothing should silently delete or modify it
without confirming intent first.

---

## Reports

Status:
Resolved (Session 4, PR #9)

Notes:
Shipped as part of the Expenses & profitability system — `expenses.tsx`
now has a `ReportsTab` and a "This Year"/"All Time" rollup (`totals.year`,
`totals.total`), not just a per-record listing. Confirmed against
current code, not assumed from the PR title.

---

## Institute Switching

Status:
Not a bug — known limitation

Issue:
A unique index limits a user to owning at most one institute (deliberate,
added to make the original duplicate-institute race condition impossible
at the data layer — see `CUTOVER.md`/`docs/HANDOVER.md`). A `staff` member
could still belong to more than one institute in principle, but there's no
institute-switcher UI for that case. Revisit only if multi-institute
ownership/membership becomes a real product requirement — needs a design
pass, not a quick fix.

---

## Pending Migrations Not Yet Applied to Production

Status:
**Action required on production** — apply with `supabase db push` (see [`docs/TWA-SETUP.md`](docs/TWA-SETUP.md)).

Code + migration files are ready on this branch:

- `20260814000000_message_templates_and_comm_logs.sql`
- `20260814230000_follow_up_threshold.sql`
- `20260820120000_is_member_requires_active_access.sql` (disabled members cannot pass RLS)

Notes:
All migrations through `20260731000000_expenses_system.sql` were previously
confirmed applied. Messaging / follow-up / `is_member` tighten still need a
live `db push` (or SQL Editor apply in filename order). After push, verify
`information_schema.role_table_grants` for `authenticated` vs `anon` /
`PUBLIC`. This cannot be completed from CI without production credentials.

---

## `student.paidFee` Still Read Directly In Three Places

Status:
Fixed (2026-08-14) — `buildContext` no longer reads `student.paidFee`

Issue:
Session 3 found a recurring bug where screens read `student.paidFee`
(a column reconciled by a best-effort background step) instead of
deriving Collected from the payments ledger. Recovery/fees/dashboard
already overwrote the field from the ledger for display.

Remaining cache reads were in `buildContext` (`pending` / `PaidAmount`
fallbacks) and `payment-row-menu.tsx` (ledger `catch` fell back to
`student.paidFee`). `buildContext` now requires callers to pass
`pending` and PaidAmount (`payment.amount` or `extras.PaidAmount`).
Receipt WhatsApp passes ledger `balance` + this payment's amount.
Payment-row-menu toasts and aborts if the ledger fetch fails instead of
lying with the cache. `students.paid_fee` is still written by
`reconcileStudentPaid` for storage; it is not used for WhatsApp math.

---

## Follow-up Threshold (Dashboard) Not Persisted

Status:
Fixed (2026-08-14) — stored on `institutes.follow_up_threshold` (default 40)

Issue:
The "Students Needing Follow-up" card's threshold is now persisted per
institute (migration `20260814230000_follow_up_threshold.sql`). Changing
the Select writes the column; owners who pick ≤20% keep that choice
across visits and devices. Apply the migration before the write will
succeed in production.

---

## Team Members Is Owner-Only

Status:
Working as built, matches the spec — flagging in case that changes

Issue:
Invite/change-role/remove team members are restricted to the `owner`
role only, matching the product's own permission table (Admin/Teacher/
Accountant are all explicitly listed as "cannot manage users"). An
`is_owner_or_admin()` helper already exists in
`20260714120001_team_members_rpcs_and_rls.sql` for future use — if
Admins should also manage users, swap `is_owner` for it in the three
RPCs (`invite_member`, `change_member_role`, `remove_member`) and update
`can()` in `src/lib/auth/roles.ts`.

---

## Expenses Were Client-Side Only (`localStorage`)

Status:
Resolved (Session 4, 2026-07-31)

Notes:
Confirmed root cause of a real user-reported data-loss incident —
`src/lib/expenses/store.ts`/`defaults.ts` persisted to browser
`localStorage` only, never Supabase. Confirmed via direct code trace (zero
Supabase calls in the file) and a live `audit_logs` query (zero
`entity='expense'` rows ever existed, so nothing was restorable
server-side either). Replaced with `expenses`/`expense_categories` tables,
same RLS/soft-delete convention as every other table. See
`docs/backend-architecture.md` §5/§9 and `docs/HANDOVER.md` Session 4 for
the full writeup.

---

## Messaging Templates Still `localStorage`-Only

Status:
Fixed in code (2026-08-20) — migration `20260814000000_message_templates_and_comm_logs.sql`
must still be applied to production (`supabase db push`). Until then the UI
loads built-in templates **offline** (WhatsApp works; edits won’t persist)
and shows a clear banner instead of a hard error. Verify grants via
`information_schema` after apply, not from the SQL file alone.

Issue:
`src/lib/messaging/store.ts` persisted templates, defaults, and comm logs
(`vidyafee.messaging.v1`) to browser `localStorage`. Replaced with
`message_templates` (soft-delete, per-institute built-in seed),
`message_template_defaults`, and `comm_logs`, same `is_member()` RLS /
`GRANT … TO authenticated` / `REVOKE … FROM PUBLIC, anon` convention as
expenses. Client loads via React Query. One-time **INSERT-only** import
of custom (non-built-in) localStorage templates; built-in local edits are
not migrated (that would UPDATE seeded rows). Built-ins themselves come
from the SQL seed/backfill.

---

## Recycle Bin / Audit Log Dual-Write Was Browser-Local

Status:
Fixed (2026-08-09) — UI now reads soft-deleted rows + `audit_logs` from Supabase

Issue:
Soft-delete for students/batches/payments *did* set `deleted` /
`deleted_at` in Supabase, and `logAudit` write-through inserted into
`audit_logs`. But the Recycle Bin UI listed items from
`vidyafee.audit.v1` in `localStorage` via `listRecycle()` /
`listLogs()`, while Deleted Expenses correctly queried the DB. Result:
deleted students/batches/payments invisible on another phone/browser;
audit trail incomplete cross-device. Recycle Bin + Audit Log now query
Supabase; `logAudit` writes only to `audit_logs`; local mirror removed.

---

## Local Storage Inventory (2026-08-09 Audit)

Status:
Catalogued — action per item below

| Store | Path | Verdict |
| --- | --- | --- |
| Auth session | `integrations/supabase/client.ts` → `localStorage` | Acceptable — Supabase Auth must persist JWT refresh tokens client-side |
| Theme preference | `components/theme-toggle.tsx` | Acceptable — UI preference only, not business data |
| Messaging templates + logs | `lib/messaging/store.ts` | **Fixed** — Supabase `message_templates` / `comm_logs` (see above); apply migration before use |
| Audit + recycle mirror | `lib/audit/store.ts` | **Fixed** — Recycle Bin + Audit Log read Supabase; `logAudit` writes `audit_logs` only |
| React Query cache | in-memory (`staleTime: 30s`) | Acceptable — not durable device storage |
| Institute logo as data URL | Settings upload → `institutes.logo_url` | **Risk** — base64 in Postgres inflates free-tier 500 MB DB; prefer Supabase Storage |
| Expense "attachment" | name only in `expenses.attachment_name` | **Gap** — file never uploaded; only filename string saved |

---

## Free-Tier Scale Risk (50–60 Institutes / ~500–600 Students)

Status:
Architectural guidance — not a code bug yet

Issue:
Target load fits Auth MAU easily (≪ 50k) but free tier is tight on:
- **500 MB DB** — `select("*")` everywhere + base64 logos + unbounded
  `listExpenses()` / `listPayments()` / `listStudents()` per page load
  will grow egress and RAM pressure on the shared free compute.
- **5 GB egress / month** — dashboard + app-header each refetch full
  student + payment lists; with ~60 concurrent owners this is the
  first limit likely to bite.
- **Project pause after 1 week inactivity** — free projects can pause;
  not suitable as a hard uptime promise for paying coaching owners.
- **No downloadable backups on free** — operational risk.

Mitigations already partially present: React Query `staleTime: 30_000`,
expense category breakdown RPC. Still needed: narrower selects, date-
range pagination for expenses/payments, Storage for logos/attachments,
avoid N+1 / duplicate list fetches (e.g. app-header search).

---

## Two Duplicate "Dnyanpeeth Classes" Institute Rows

Status:
Needs decision — not touched

Issue:
Two `institutes` rows exist with the identical name "Dnyanpeeth Classes"
(`5577d52e-84da-4272-8f58-c621cf115c63` and
`ca9b2db1-3a4d-4f38-ba97-f716598bb86b`), found during the Expenses
migration's institute backfill (both got the correct 24 seeded categories).
Not the same issue as "Second Test Account With No Institute" above (that's
a *user* with no institute; this is two separate *institute* rows sharing
a name). Nothing merged, deleted, or modified — waiting on the account
owner to confirm whether this is intentional.

---

## `audit_logs.entity = "category"` — Was Dead Code, Now Real

Status:
Resolved as a side effect of the Expenses system (Session 4, 2026-07-31)

Notes:
`"category"` existed in the `AuditEntity` type union from early on but was
never actually written anywhere — confirmed via a live query: before the
Expenses system shipped, `audit_logs` had exactly 6 rows total, all
`entity='attendance'`. The Expenses system's category CRUD
(`addExpenseCategory`/`renameExpenseCategory`/`toggleExpenseCategory`/
`deleteExpenseCategory` in `src/lib/data/adapter.ts`) now actually calls
`logAudit({ entity: "category", ... })`, so this path is exercised for the
first time.

---

## Attendance Migration's `REVOKE ... FROM PUBLIC, anon` Fix Wasn't Committed

Status:
Resolved (Session 4, 2026-07-31)

Notes:
The fix that revokes default `PUBLIC`/`anon` `EXECUTE` grants on
`save_attendance`/`mark_attendance_status` (Postgres grants these by
default unless explicitly revoked) was applied directly to production
during the Attendance build, but the corresponding migration file was
never committed to this repo — meaning a fresh schema rebuild from
`supabase/migrations/*.sql` (per `SETUP.md`/`BACKUP.md`'s promise) would
have silently missed it. Found and fixed during this documentation pass:
`20260730060000_revoke_public_anon_execute_attendance.sql` now exists;
applying it again against the already-patched live database is a safe
no-op. The standing rule this established — every new table/RPC gets its
`REVOKE`/grant check in the *same* migration, verified via
`information_schema` before considering the migration done — is documented
explicitly in `docs/backend-architecture.md` §6.
