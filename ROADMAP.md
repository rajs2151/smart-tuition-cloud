# Roadmap

This is the source of truth for planned work — check here before asking for
a new task list. Update in place as items complete or priorities shift.

---

## Phase 1 — Foundation & core workflows

- [x] Bulk Student Import — done (2026-07-09)
- [x] Receipts (generate, view, print/PDF) — done, but see the PDF-export
  color bug in `KNOWN_ISSUES.md`
- [ ] Fix PDF export color rendering (`oklch()` vs. `html2canvas`) —
  see `KNOWN_ISSUES.md` for root cause and candidate fixes
- [ ] Reports — yearly expense report (aggregate/rollup view, not just
  per-record listing)
- [ ] Staff invitation UI (schema/RLS already support it — just needs a
  frontend)
- [ ] Push the CI migration-validation workflow (blocked on a
  properly-scoped GitHub token — see `KNOWN_ISSUES.md`)
- [ ] Enable leaked-password protection in Supabase Auth settings
- [ ] Automated end-to-end test coverage for the sign-up → onboarding →
  dashboard flow (currently verified manually + via direct database
  simulation, not by a repeatable automated test)

## Phase 2 — Communication & operations

- [ ] WhatsApp (fee reminders, receipt delivery, or similar — scope not
  yet defined)
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
