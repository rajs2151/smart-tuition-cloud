# Roadmap

This is the source of truth for planned work — check here before asking for
a new task list. Update in place as items complete or priorities shift.

---

## Phase 1 — Foundation & core workflows

- [x] Bulk Student Import — done (2026-07-09); extended in Session 3
  (2026-07-16) to create real historical payment records (Payment
  Timeline/receipts were previously left empty for imported students)
- [x] Receipts (generate, view, print/PDF) — done, but see the PDF-export
  color bug in `KNOWN_ISSUES.md`
- [x] Fix PDF export color rendering (`oklch()` vs. `html2canvas`) — done
  (2026-07-10), switched to `html2canvas-pro`; see `KNOWN_ISSUES.md`
- [x] Staff invitation UI — done (2026-07-14/15, Session 3), built as
  full multi-user Team Members (owner/admin/teacher/accountant roles,
  invite by email, pending-invite auto-linking, 5-seat cap)
- [x] Selectable Payment Date on manual payments — done (Session 3)
- [x] Receipt-specific contact info override (Phone/Email/Website) —
  done (Session 3)
- [x] Batch Fee Report and Batch Collection Report (date-range,
  transaction-level) — done (Session 3)
- [x] Dashboard redesign — click-through drill-downs, Collection
  Efficiency KPI, Students Needing Follow-up (replacing Payment Modes),
  fixed the broken Collection Trend chart — done (2026-07-16, Session 3)
- [x] Recurring "different screens show different Collected/Due for the
  same student" bug — found and fixed across five screens in Session 3
  (Student Details, Fees list, Batch Fee Report, Dashboard, Student
  List, receipt page); three confirmed-remaining spots (WhatsApp
  messages, recovery page) are tracked in `KNOWN_ISSUES.md`, not yet
  fixed
- [x] Batch Total Course Fee changes now propagate to every enrolled
  student — done (2026-07-18, Session 3); previously a student's fee was
  only copied from the batch at creation and never updated afterward
- [ ] Apply Session 3's four pending migrations to the live database —
  see `KNOWN_ISSUES.md` ("Pending Migrations Not Yet Applied to
  Production"); this already caused one real production error
- [ ] Reports — yearly expense report (aggregate/rollup view, not just
  per-record listing)
- [ ] Push the CI migration-validation workflow (blocked on a
  properly-scoped GitHub token — see `KNOWN_ISSUES.md`)
- [ ] Enable leaked-password protection in Supabase Auth settings
- [ ] Automated end-to-end test coverage for the sign-up → onboarding →
  dashboard flow (currently verified manually + via direct database
  simulation, not by a repeatable automated test)
- [ ] Fix the three remaining `student.paidFee` reads (WhatsApp message
  content, recovery page) the same way the other five screens were
  fixed in Session 3 — see `KNOWN_ISSUES.md`
- [ ] Decide whether Team Members management should extend to Admins
  (currently owner-only, matching the spec) — see `KNOWN_ISSUES.md`
- [ ] Decide whether the Dashboard's Follow-up threshold should persist
  per-institute instead of resetting every session — see
  `KNOWN_ISSUES.md`

## Phase 2 — Communication & operations

- [x] WhatsApp fee reminders and payment acknowledgements — already
  substantially implemented (`src/lib/messaging/whatsapp.ts`, templates
  in Settings, "Send WhatsApp reminder" on Fees/Student Details,
  acknowledgement send on payment rows/receipts). Not built in Session
  3; correcting this roadmap entry, which was stale relative to the
  actual codebase. Remaining gap: the pending-amount figures fed into
  these messages still read the same stale `student.paidFee` column
  fixed elsewhere this session — see `KNOWN_ISSUES.md`.
- [ ] Attendance tracking (per batch/student)
- [ ] SMS (likely overlapping use case with WhatsApp — decide if both are
  needed or one supersedes the other)

## Phase 3 — Expansion

- [ ] Parent Portal (read-only view for parents: fees, attendance, etc.)
- [ ] Teacher App (a lighter-weight, teacher-facing view — likely mobile)
- [ ] AI Assistant (scope not yet defined — could range from a support
  chatbot to automated insights/summaries over institute data)

---

## Notes on prioritization

- Phase 1 items above marked `[ ]` are the most immediately actionable —
  most are small, well-scoped, and don't require new product decisions.
- Phase 2/3 items are larger in scope and will each need their own
  requirements pass (e.g. WhatsApp needs a decision on provider/API,
  Parent Portal needs a decision on what data parents should see and how
  they authenticate) before implementation starts.
- If priorities change, update the checkboxes/lists above directly rather
  than re-deriving this list from scratch each time.
