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
Pending

Issue:
`src/lib/pdf/export.ts` renders a DOM element to canvas via `html2canvas`
(`^1.4.1`) before writing it into a PDF via `jsPDF`. The app's entire theme
(`src/styles.css`) defines colors using the modern CSS `oklch()` function —
confirmed 79 separate uses across backgrounds, text, borders, and shadows.
`html2canvas` 1.4.1's color parser does not understand `oklch()` (or
`oklab()`/`color-mix()`), and will either throw
(`Attempting to parse an unsupported color function "oklch"`) or silently
mis-render colors when it encounters one. This affects both call sites:
receipt PDF export (`src/routes/receipts.$id.tsx`) and admission form PDF
export (`src/routes/students.$id.tsx`).

Likely fixes (not yet attempted): render the exported element with an
explicit inline/computed style override to plain `rgb()`/`hex` values
before calling `html2canvas` (e.g. a print-specific stylesheet or a
pre-export style pass), or switch to a canvas-rendering library with
`oklch()` support, or upgrade `html2canvas` if/when a version adds support.

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
Pending

Issue:
The schema and RLS already support an owner adding a `staff` member
(`institute_members` insert, policy-restricted to owners of that
institute), but there's no UI for it. An owner currently has no way to add
staff except direct SQL.

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
