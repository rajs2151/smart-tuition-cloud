# Known Issues

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
Open — root cause unconfirmed, active investigation (PR #17)

Issue:
Reported: opening "Add Expense" on mobile leaves the page zoomed
out/misaligned, persisting after closing the dialog and across
subsequent tab switches until manually reset.

Investigated and ruled out:
- Every `<Input>`/`<Textarea>`/`<Select>` in `ExpenseDialog` itself uses
  the app's safe default (`text-base` at the base/mobile breakpoint,
  `md:text-sm` only for desktop) — no per-instance override found.
- A real, separate sub-16px violation *was* found and fixed this
  session, but in a different file: `recovery.tsx`'s reminder-
  customization `Textarea` had `text-xs` (12px) unconditionally
  overriding the safe default via tailwind-merge. Fixed. Confirmed via
  before/after lint diff that this didn't affect anything else.

Currently being tested (in order, each a distinct, separately-checkable
mechanism — not the same theory restated):
1. **The `type="file"` attachment input** (PR #17, result pending as of
   this writing) — tests two different possible explanations at once,
   worth untangling if the zoom turns out to disappear:
   (a) an unconfirmed WebKit-specific theory: iOS Safari's native
   file-picker sheet interacting badly with the dialog's
   `position: fixed` + Radix's internal scroll-lock, leaving the
   viewport miscalculated after the sheet closes — nothing to do with
   font-size at all; or
   (b) a **newly-found, more mundane, directly comparable-to-recovery.tsx
   possibility**: the shared `Input` component applies `file:text-sm`
   (14px) to the "Choose file" button label specifically —
   unconditionally, no `md:` override, unlike the input's own overall
   `text-base md:text-sm`. This was missed in the original investigation,
   which only checked overall input text size, not the `file:*` variant.
   If removing the file input makes the zoom disappear, a follow-up test
   (restore the field, but override just `file:text-base`) is needed to
   tell (a) and (b) apart — PR #17's test alone can't distinguish them.
2. **`SelectTrigger`'s hardcoded `text-sm`** (14px, no `md:` override,
   confirmed present at `src/components/ui/select.tsx` — `ExpenseDialog`
   uses it twice, Category and Payment mode) — the current lead per
   testing plan as of this writing. Worth noting for calibration: a
   `SelectTrigger` is a button/combobox, not a native text-typing
   surface, so it's a structurally different candidate than an `<Input>`/
   `<Textarea>` — mobile browsers' auto-zoom-on-focus is specifically
   documented as a text-input-focus behavior. Flagging this as a reason
   it's a slightly lower-confidence lead than a native input would be,
   not a reason to skip testing it.

No live iOS Safari device has been available to any session working on
this — every step above was investigated via code reading, not
reproduced firsthand. Don't close this out as resolved based on a
type-checks-clean/builds-clean verification alone; it needs an actual
device confirmation.

---

## `get_expense_breakdown_by_category` — Reachable, But Nothing Calls It

Status:
Confirmed dead code, one level removed from the RPC itself

Issue:
The RPC (`supabase/migrations/20260731000000_expenses_system.sql`) *is*
wired into a real adapter function,
`getExpenseBreakdownByCategory()` (`src/lib/data/adapter.ts`) — so it's
not dead at the SQL/RPC level. But grepping every `.tsx` file for a call
to that adapter function turns up nothing — no route or component
anywhere in the app actually calls it. The RPC exists, is grantable, is
correctly typed, and never fires from the UI. Either wire it into the
Expenses Reports/Categories tab (a natural fit — the plumbing already
returns exactly a category breakdown), or remove it if it's not
actually planned to be used.

---

## Categories Tab: Switch Tap-Target and Label Gaps

Status:
Confirmed

Issue:
The category active/inactive `<Switch>` in Expenses → Categories
(`src/routes/expenses.tsx`) is `h-5 w-9` (20×36px) via the shared
`Switch` component (`src/components/ui/switch.tsx`) — well under the
44px minimum tap-target convention already established elsewhere in this
app (`h-11 w-11`, used in `batches.tsx`/`expenses.tsx`'s own delete
button right next to this same Switch). It also has no `aria-label` or
associated `<label>`/`htmlFor` — the category name text sits visually
next to it but isn't programmatically linked, so a screen reader
announces only "switch, on/off" with no indication of which category.
The adjacent Delete button in the same row does have `aria-label`/
`title` — this Switch is the outlier in its own row, not just relative to
the rest of the app.

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
Pending

Issue:
`.github/workflows/validate-migrations.yml` exists locally and is written
to spin up a real local Supabase stack and apply every migration against
it, but hasn't been pushed to `main` — the GitHub token used in this
session lacked the `workflow` scope/permission GitHub requires specifically
for pushing changes under `.github/workflows/`. Needs a token with that
scope (classic PAT: check `workflow`; fine-grained PAT: add "Workflows:
Read and write" permission) to land.

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
Resolved

Notes:
All 15 migrations currently on `main` (up through
`20260731000000_expenses_system.sql`) are confirmed applied to the live
Supabase project — the Session 4 features (Attendance, Expenses) are
working end-to-end against real data, which wouldn't be possible
otherwise. See `docs/HANDOVER.md`'s Database architecture section for one
remaining gap: a `REVOKE EXECUTE` hardening fix that's confirmed already
applied live but not yet committed as a migration file (sitting in the
still-open PR #10).

---

## `student.paidFee` Still Read Directly In Three Places

Status:
Flagged, not fixed — re-confirmed still accurate as of Session 4

Issue:
Session 3 found and fixed a recurring bug where several screens read
`student.paidFee` (a column reconciled by a best-effort background step)
instead of deriving Collected live from the payments ledger — fixed on
Student Details, Fees list, Batch Fee Report, Dashboard, Student List,
and the individual receipt page. Grepping the codebase after those
fixes turned up three more places with the same pattern, not yet
touched: the WhatsApp acknowledgement subtype/pending-amount logic
(`src/components/payment-row-menu.tsx`, `src/lib/messaging/whatsapp.ts`)
and the recovery/reminders page (`src/routes/recovery.tsx`). Re-checked
directly against current code during this Session 4 docs pass — all
three still read `student.paidFee` unchanged; nothing in the Session 4
feature work happened to touch this. Same staleness risk; fixing these
means loading each student's payment list on pages that don't currently
fetch it.

---

## Follow-up Threshold (Dashboard) Not Persisted

Status:
Working as built, may need revisiting

Issue:
The "Students Needing Follow-up" card's threshold (default ≤40%
collected) is a plain client-side Select, reset to the default every
session/page load — not stored per-institute. Built this way
deliberately (a settings field + migration felt disproportionate to
what was asked), but worth revisiting if owners want their chosen
threshold to persist across visits/devices.

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
Flagged, not fixed

Issue:
`src/lib/messaging/store.ts` persists to browser `localStorage`, not
Supabase — the same category of risk that caused the Expenses data-loss
incident above. A `mergeTemplates`/`resolveDefaults` fix was added during
the Attendance build (Session 4) so existing localStorage state doesn't
silently miss new built-in templates, but the underlying storage is still
local, not server-side/cross-device.

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
