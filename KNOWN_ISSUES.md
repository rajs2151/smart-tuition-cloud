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

Need a yearly expense report (aggregate view of expenses over a full year,
not currently available — `src/routes/expenses.tsx` currently shows
per-record entries without a yearly rollup/summary view).

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
Needs action — confirmed to have caused a real production error

Issue:
Four migrations added in Session 3 are committed to `main` but have not
been run against the live Supabase project:
`20260713080000_add_receipt_contact_overrides.sql`,
`20260714120000_team_members_schema.sql`,
`20260714120001_team_members_rpcs_and_rls.sql`,
`20260718090000_sync_batch_course_fee.sql`. This is not a hypothetical
risk — `institute_members.status` (added by the Team Members schema
migration) not existing yet on the live project caused a real
"Couldn't load your account" error in production mid-session, since
`session.ts` treats that query failure as a genuine, recoverable error
state. Apply via `supabase db push` or the SQL editor, in the order
listed, before relying on any Session 3 feature end to end.

---

## `student.paidFee` Still Read Directly In Three Places

Status:
Flagged, not fixed

Issue:
Session 3 found and fixed a recurring bug where several screens read
`student.paidFee` (a column reconciled by a best-effort background step)
instead of deriving Collected live from the payments ledger — fixed on
Student Details, Fees list, Batch Fee Report, Dashboard, Student List,
and the individual receipt page. Grepping the codebase after those
fixes turned up three more places with the same pattern, not yet
touched: the WhatsApp acknowledgement subtype/pending-amount logic
(`src/components/payment-row-menu.tsx`, `src/lib/messaging/whatsapp.ts`)
and the recovery/reminders page (`src/routes/recovery.tsx`). Same
staleness risk; fixing these means loading each student's payment list
on pages that don't currently fetch it.

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

## No Spacing Design-Token System (Deferred)

Status:
Deferred — future improvement, not fixed in the design-consistency pass

Issue:
`src/styles.css`'s `@theme inline` block defines real, deliberate tokens
for color (`--color-success`, `--color-warning`, etc.) and radius
(`--radius-sm` through `--radius-4xl`, derived from one `--radius` base),
but has no equivalent for spacing — zero `--spacing-*` custom properties
anywhere. Every `p-4`/`gap-3`/`space-y-4` in the app is just whichever
Tailwind default increment that component's author picked, with no
project-level rhythm enforced (this is why `ContactOverrideField` needed
a manual `gap-3` fix in an earlier PR — there was no shared convention to
have caught the missing gap earlier). Introducing a `--spacing-*` token
scale now and retrofitting every existing spacing utility against it is a
bigger structural change than the design-consistency pass this was found
during was scoped for — noted here for future work, not attempted now.

---

## Dashboard `Kpi` Cards — Same Decorative-Color Pattern as the Quick-Action Cards

Status:
Found, not fixed — outside the scope of what was approved in the
design-consistency pass that found it

Issue:
`src/routes/index.tsx`'s `Kpi` component (used for the 6 dashboard metric
cards — Total students, Collection efficiency, Active batches, Total
collection, Pending fees, Monthly revenue) has the same per-card
decorative-tone pattern the 4 quick-action cards above it had (already
fixed). Most of these aren't tied to an actual data state ("Active
batches" tinted `warning` isn't a warning; "Total collection" tinted
`success` is just a running total, not a state). One is genuinely
semantic and should probably be kept or even strengthened rather than
neutralized: "Pending fees" tinted `warning` does represent a real
condition worth flagging. Not touched — found while implementing the
already-approved fix elsewhere in the same file, flagged rather than
silently expanded into.
