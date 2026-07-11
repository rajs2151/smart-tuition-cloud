-- =========================================================
-- Batch fee model: monthly_fee -> total_course_fee
--
-- Batches used to store a per-month fee, and every call site that needed
-- a student's course fee computed it as `monthlyFee * 12` at admission
-- time (see the old add-student-dialog.tsx / import-students-dialog.tsx).
-- Batches now store the Total Course Fee directly, and new admissions
-- copy it as-is (no multiplication) - see item 1/2 of the fee-workflow
-- simplification.
--
-- RENAME preserves the column's NOT NULL / DEFAULT 0 constraint and every
-- existing value, so existing rows are backfilled below (old_value * 12)
-- rather than lost or zeroed: a batch that used to bill ₹1,500/month now
-- shows a Total Course Fee of ₹18,000 - the same annual fee the app was
-- already computing for students admitted under the old model.
--
-- `public.students.course_fee` is its own independent column (see
-- 20260703064918_..._students table), not derived from the batch, so
-- already-admitted students and their payment history are completely
-- unaffected by this migration either way.
-- =========================================================

ALTER TABLE public.batches RENAME COLUMN monthly_fee TO total_course_fee;

UPDATE public.batches SET total_course_fee = total_course_fee * 12;
