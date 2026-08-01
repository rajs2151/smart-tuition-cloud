/**
 * Data adapter — Supabase-backed. All queries are automatically scoped by the
 * active institute via Row Level Security (see migration policies).
 *
 * Function signatures match the previous mock-array implementation so UI
 * components do not need to change.
 */

import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/store";
import { addRecycle, logAudit, removeRecycle } from "@/lib/audit/store";
import type {
  AttendanceAbsence,
  AttendanceSession,
  AttendanceSessionStatus,
  Batch,
  Installment,
  Payment,
  Student,
} from "./types";
import type { Expense, ExpenseCategory, ExpensePaymentMode } from "@/lib/expenses/types";

const currentUser = () => getSession().email ?? "user";
const activeInstituteId = () => {
  const id = getSession().instituteId ?? getSettings().institute.id;
  if (!id) throw new Error("No active institute — user must be signed in and belong to an institute.");
  return id;
};
/** Returns the active institute id, or null when there is no session yet
 *  (SSR, signed-out, or pre-onboarding). List queries use this to short-circuit
 *  to an empty result during SSR so route loaders don't 500 before AuthGate mounts. */
const activeInstituteIdOrNull = (): string | null => {
  return getSession().instituteId ?? getSettings().institute.id ?? null;
};

// ============ mappers ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBatch(r: any): Batch {
  return {
    id: r.id,
    instituteId: r.institute_id,
    name: r.name,
    type: r.type,
    standard: r.standard ?? undefined,
    board: r.board ?? undefined,
    medium: r.medium ?? undefined,
    examCategory: r.exam_category ?? undefined,
    examYear: r.exam_year ?? undefined,
    faculty: r.faculty ?? undefined,
    totalCourseFee: Number(r.total_course_fee ?? 0),
    capacity: r.capacity ?? 0,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    active: !!r.active,
    course: r.course ?? undefined,
    strength: r.strength ?? undefined,
    deleted: !!r.deleted,
    deletedAt: r.deleted_at ?? undefined,
    deletedBy: r.deleted_by ?? undefined,
  };
}
function fromBatch(b: Partial<Batch>): any {
  const row: Record<string, unknown> = {};
  if (b.name !== undefined) row.name = b.name;
  if (b.type !== undefined) row.type = b.type;
  if (b.standard !== undefined) row.standard = b.standard;
  if (b.board !== undefined) row.board = b.board;
  if (b.medium !== undefined) row.medium = b.medium;
  if (b.examCategory !== undefined) row.exam_category = b.examCategory;
  if (b.examYear !== undefined) row.exam_year = b.examYear;
  if (b.faculty !== undefined) row.faculty = b.faculty;
  if (b.totalCourseFee !== undefined) row.total_course_fee = b.totalCourseFee;
  if (b.capacity !== undefined) row.capacity = b.capacity;
  if (b.startDate !== undefined) row.start_date = b.startDate || null;
  if (b.endDate !== undefined) row.end_date = b.endDate || null;
  if (b.active !== undefined) row.active = b.active;
  if (b.course !== undefined) row.course = b.course;
  if (b.strength !== undefined) row.strength = b.strength;
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStudent(r: any): Student {
  return {
    id: r.id,
    instituteId: r.institute_id,
    rollNo: r.roll_no ?? "",
    name: r.name,
    phone: r.phone ?? "",
    parentName: r.parent_name ?? undefined,
    parentPhone: r.parent_phone ?? undefined,
    email: r.email ?? undefined,
    address: r.address ?? undefined,
    photo: r.photo ?? undefined,
    dob: r.date_of_birth ?? undefined,
    batchId: r.batch_id ?? "",
    standard: r.standard ?? undefined,
    board: r.board ?? undefined,
    medium: r.medium ?? undefined,
    examCategory: r.exam_category ?? undefined,
    courseFee: Number(r.course_fee ?? 0),
    admissionFee: Number(r.admission_fee ?? 0),
    discount: Number(r.discount ?? 0),
    totalFee: Number(r.total_fee ?? 0),
    paidFee: Number(r.paid_fee ?? 0),
    installments: (r.installments ?? []) as Installment[],
    admissionDate: r.admission_date ?? new Date().toISOString().slice(0, 10),
    status: (r.status ?? "active") as Student["status"],
    course: r.course ?? undefined,
    deleted: !!r.deleted,
    deletedAt: r.deleted_at ?? undefined,
    deletedBy: r.deleted_by ?? undefined,
  };
}
function fromStudent(s: Partial<Student>): any {
  const row: Record<string, unknown> = {};
  if (s.rollNo !== undefined) row.roll_no = s.rollNo;
  if (s.name !== undefined) row.name = s.name;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.parentName !== undefined) row.parent_name = s.parentName;
  if (s.parentPhone !== undefined) row.parent_phone = s.parentPhone;
  if (s.email !== undefined) row.email = s.email;
  if (s.address !== undefined) row.address = s.address;
  if (s.photo !== undefined) row.photo = s.photo;
  if (s.dob !== undefined) row.date_of_birth = s.dob || null;
  if (s.batchId !== undefined) row.batch_id = s.batchId || null;
  if (s.standard !== undefined) row.standard = s.standard;
  if (s.board !== undefined) row.board = s.board;
  if (s.medium !== undefined) row.medium = s.medium;
  if (s.examCategory !== undefined) row.exam_category = s.examCategory;
  if (s.courseFee !== undefined) row.course_fee = s.courseFee;
  if (s.admissionFee !== undefined) row.admission_fee = s.admissionFee;
  if (s.discount !== undefined) row.discount = s.discount;
  if (s.totalFee !== undefined) row.total_fee = s.totalFee;
  if (s.paidFee !== undefined) row.paid_fee = s.paidFee;
  if (s.installments !== undefined) row.installments = s.installments;
  if (s.admissionDate !== undefined) row.admission_date = s.admissionDate;
  if (s.status !== undefined) row.status = s.status;
  if (s.course !== undefined) row.course = s.course;
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPayment(r: any): Payment {
  return {
    id: r.id,
    instituteId: r.institute_id,
    studentId: r.student_id,
    amount: Number(r.amount ?? 0),
    date: r.date,
    mode: r.mode as Payment["mode"],
    receiptNo: r.receipt_no,
    note: r.note ?? undefined,
    type: (r.type ?? "fee") as Payment["type"],
    deleted: !!r.deleted,
    deletedAt: r.deleted_at ?? undefined,
    deletedBy: r.deleted_by ?? undefined,
    voided: !!r.voided,
    voidedAt: r.voided_at ?? undefined,
    voidedBy: r.voided_by ?? undefined,
  };
}

// ============ Students ============

export async function listStudents(includeDeleted = false): Promise<Student[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const q = supabase
    .from("students")
    .select("*")
    .eq("institute_id", instId)
    .order("created_at", { ascending: false });
  const { data, error } = includeDeleted ? await q : await q.eq("deleted", false);
  if (error) throw error;
  return (data ?? []).map(toStudent);
}

export async function getStudent(id: string): Promise<Student | undefined> {
  const { data, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toStudent(data) : undefined;
}

export async function createStudent(s: Omit<Student, "id" | "instituteId">): Promise<Student> {
  const insertRow = { ...fromStudent(s), institute_id: activeInstituteId() };
  const { data, error } = await supabase.from("students").insert(insertRow).select("*").single();
  if (error) throw error;
  const created = toStudent(data);
  logAudit({ entity: "student", entityId: created.id, action: "create", by: currentUser(), summary: `Admitted ${created.name}` });
  return created;
}

export async function updateStudent(id: string, patch: Partial<Student>) {
  const { data: before } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("students")
    .update(fromStudent(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const st = toStudent(data);
  logAudit({
    entity: "student",
    entityId: id,
    action: "update",
    by: currentUser(),
    summary: `Updated ${st.name}`,
    oldValue: before ? toStudent(before) : undefined,
    newValue: st,
  });
  return st;
}

export async function deleteStudent(id: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("students")
    .update({ deleted: true, deleted_at: now, deleted_by: getSession().userId })
    .eq("id", id)
    .select("name")
    .single();
  if (error) throw error;
  addRecycle({ entity: "student", entityId: id, label: data.name, deletedAt: now, deletedBy: currentUser() });
  logAudit({ entity: "student", entityId: id, action: "delete", by: currentUser(), summary: `Archived ${data.name}` });
}
export async function restoreStudent(id: string) {
  const { data, error } = await supabase
    .from("students")
    .update({ deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", id)
    .select("name")
    .single();
  if (error) throw error;
  removeRecycle("student", id);
  logAudit({ entity: "student", entityId: id, action: "restore", by: currentUser(), summary: `Restored ${data.name}` });
}
export async function purgeStudent(id: string) {
  const { data } = await supabase.from("students").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
  removeRecycle("student", id);
  logAudit({ entity: "student", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted ${data?.name ?? id}` });
}

// ============ Batches ============

export async function listBatches(includeDeleted = false): Promise<Batch[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const q = supabase
    .from("batches")
    .select("*")
    .eq("institute_id", instId)
    .order("created_at", { ascending: false });
  const { data, error } = includeDeleted ? await q : await q.eq("deleted", false);
  if (error) throw error;
  return (data ?? []).map(toBatch);
}

export async function createBatch(b: Omit<Batch, "id" | "instituteId">): Promise<Batch> {
  const { data, error } = await supabase
    .from("batches")
    .insert({ ...fromBatch(b), institute_id: activeInstituteId() })
    .select("*")
    .single();
  if (error) throw error;
  const created = toBatch(data);
  logAudit({ entity: "batch", entityId: created.id, action: "create", by: currentUser(), summary: `Created batch ${created.name}` });
  return created;
}

export async function updateBatch(id: string, patch: Partial<Batch>): Promise<Batch> {
  const { data: before } = await supabase
    .from("batches")
    .select("total_course_fee")
    .eq("id", id)
    .maybeSingle();
  const { data, error } = await supabase.from("batches").update(fromBatch(patch)).eq("id", id).select("*").single();
  if (error) throw error;
  const b = toBatch(data);
  if (
    patch.totalCourseFee !== undefined &&
    Number(before?.total_course_fee) !== patch.totalCourseFee
  ) {
    try {
      const { error: syncErr } = await supabase.rpc("sync_batch_course_fee", {
        _batch_id: id,
        _new_fee: patch.totalCourseFee,
      });
      if (syncErr) throw syncErr;
    } catch (e) {
      console.error(`[updateBatch] sync_batch_course_fee failed for batch ${id}:`, e);
    }
  }
  logAudit({ entity: "batch", entityId: id, action: "update", by: currentUser(), summary: `Updated batch ${b.name}` });
  return b;
}

export async function deleteBatch(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("batches")
    .update({ deleted: true, deleted_at: now, deleted_by: getSession().userId })
    .eq("id", id)
    .select("name")
    .single();
  if (error) throw error;
  addRecycle({ entity: "batch", entityId: id, label: data.name, deletedAt: now, deletedBy: currentUser() });
  logAudit({ entity: "batch", entityId: id, action: "delete", by: currentUser(), summary: `Moved batch ${data.name} to recycle bin` });
}
export async function restoreBatch(id: string) {
  const { data, error } = await supabase
    .from("batches")
    .update({ deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", id)
    .select("name")
    .single();
  if (error) throw error;
  removeRecycle("batch", id);
  logAudit({ entity: "batch", entityId: id, action: "restore", by: currentUser(), summary: `Restored batch ${data.name}` });
}
export async function purgeBatch(id: string) {
  const { data } = await supabase.from("batches").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("batches").delete().eq("id", id);
  if (error) throw error;
  removeRecycle("batch", id);
  logAudit({ entity: "batch", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted batch ${data?.name ?? id}` });
}

// ============ Payments ============

export async function listPayments(includeDeleted = false): Promise<Payment[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const q = supabase
    .from("payments")
    .select("*")
    .eq("institute_id", instId)
    .order("date", { ascending: false });
  const { data, error } = includeDeleted ? await q : await q.eq("deleted", false);
  if (error) throw error;
  return (data ?? []).map(toPayment);
}

export interface BatchReportPayment extends Payment {
  studentName: string;
}

/**
 * Payments for one batch within a date range, for the Batch Collection
 * Report. Queries only that batch's students within that date range
 * (via the existing payments.student_id -> students FK) rather than
 * fetching every institute payment and filtering client-side. Excludes
 * voided/deleted payments, matching the definition of "collected" used
 * on the Fees page, Receipts page, and Student Payment Timeline, so
 * totals here always agree with those.
 */
export async function listPaymentsForBatchInRange(
  batchId: string,
  fromDate: string,
  toDate: string,
): Promise<BatchReportPayment[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const { data, error } = await supabase
    .from("payments")
    .select("*, students!inner(name, batch_id)")
    .eq("institute_id", instId)
    .eq("students.batch_id", batchId)
    .eq("deleted", false)
    .eq("voided", false)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...toPayment(row),
    studentName: row.students?.name ?? "",
  }));
}

export async function listPaymentsByStudent(studentId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", studentId)
    .eq("deleted", false)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toPayment);
}

/**
 * Recomputes and persists a student's cached paid_fee total from their
 * non-deleted, non-voided payments. This is derived cache-maintenance —
 * the payments table is the actual source of truth — so a failure here
 * must never be reported as a failure of whatever payment mutation
 * (create/edit/void/delete/restore) just triggered it: that mutation's
 * own write already succeeded and is durable. Errors are logged, not
 * thrown, so the operation the user asked for still reports success.
 * If this does fail, the cached total self-corrects the next time any
 * payment activity happens for this student.
 */
async function reconcileStudentPaid(studentId: string) {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("amount")
      .eq("student_id", studentId)
      .eq("deleted", false)
      .eq("voided", false);
    if (error) throw error;
    const paid = (data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const { error: updErr } = await supabase
      .from("students")
      .update({ paid_fee: paid })
      .eq("id", studentId);
    if (updErr) throw updErr;
  } catch (e) {
    console.error(`[reconcileStudentPaid] failed for student ${studentId}:`, e);
  }
}

export async function recordPayment(
  input: Omit<Payment, "id" | "receiptNo" | "instituteId">,
): Promise<Payment> {
  const instituteId = activeInstituteId();
  const { data: rn, error: rnErr } = await supabase.rpc("next_receipt_number", { _institute: instituteId });
  if (rnErr) throw rnErr;
  const receiptNo = rn as unknown as string;

  const { data, error } = await supabase
    .from("payments")
    .insert({
      institute_id: instituteId,
      student_id: input.studentId,
      amount: input.amount,
      date: input.date,
      mode: input.mode,
      receipt_no: receiptNo,
      note: input.note,
      type: input.type,
    })
    .select("*")
    .single();
  if (error) throw error;
  const created = toPayment(data);
  await reconcileStudentPaid(input.studentId);
  logAudit({ entity: "payment", entityId: created.id, action: "create", by: currentUser(), summary: `Recorded payment ${created.receiptNo} (₹${created.amount})` });
  return created;
}

export async function updatePayment(id: string, patch: Partial<Payment>) {
  const { data: before } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  const row: any = {};
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.mode !== undefined) row.mode = patch.mode;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.type !== undefined) row.type = patch.type;
  const { data, error } = await supabase.from("payments").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  const after = toPayment(data);
  await reconcileStudentPaid(after.studentId);
  logAudit({
    entity: "payment",
    entityId: id,
    action: "update",
    by: currentUser(),
    summary: `Edited payment ${after.receiptNo}`,
    oldValue: before ? { amount: before.amount, date: before.date, mode: before.mode, note: before.note } : undefined,
    newValue: { amount: after.amount, date: after.date, mode: after.mode, note: after.note },
  });
  return after;
}

/**
 * Void a payment. Unlike deletePayment (soft-delete to the Recycle Bin,
 * hidden from normal views), a voided payment stays visible and
 * searchable in payment history — it only stops counting towards
 * collected/outstanding totals (see reconcileStudentPaid).
 */
export async function voidPayment(id: string): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .update({ voided: true, voided_at: new Date().toISOString(), voided_by: getSession().userId })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const p = toPayment(data);
  await reconcileStudentPaid(p.studentId);
  logAudit({
    entity: "payment",
    entityId: id,
    action: "void",
    by: currentUser(),
    summary: `Voided payment ${p.receiptNo} (₹${p.amount})`,
    oldValue: { voided: false },
    newValue: { voided: true },
  });
  return p;
}

export async function deletePayment(id: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("payments")
    .update({ deleted: true, deleted_at: now, deleted_by: getSession().userId })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const p = toPayment(data);
  await reconcileStudentPaid(p.studentId);
  addRecycle({ entity: "payment", entityId: id, label: `${p.receiptNo} · ₹${p.amount}`, deletedAt: now, deletedBy: currentUser() });
  logAudit({ entity: "payment", entityId: id, action: "delete", by: currentUser(), summary: `Moved payment ${p.receiptNo} to recycle bin` });
}
export async function restorePayment(id: string) {
  const { data, error } = await supabase
    .from("payments")
    .update({ deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const p = toPayment(data);
  await reconcileStudentPaid(p.studentId);
  removeRecycle("payment", id);
  logAudit({ entity: "payment", entityId: id, action: "restore", by: currentUser(), summary: `Restored payment ${p.receiptNo}` });
}
export async function purgePayment(id: string) {
  const { data } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
  if (data) await reconcileStudentPaid(data.student_id);
  removeRecycle("payment", id);
  logAudit({ entity: "payment", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted payment ${data?.receipt_no ?? id}` });
}

// ============ Attendance ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAttendanceSession(r: any): AttendanceSession {
  return {
    id: r.id,
    instituteId: r.institute_id,
    batchId: r.batch_id,
    sessionDate: r.session_date,
    status: r.status as AttendanceSessionStatus,
    totalStudents: r.total_students ?? 0,
    absentCount: r.absent_count ?? 0,
    markedBy: r.marked_by ?? undefined,
    markedAt: r.marked_at,
    updatedAt: r.updated_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAttendanceAbsence(r: any): AttendanceAbsence {
  return {
    id: r.id,
    sessionId: r.session_id,
    studentId: r.student_id,
    reason: r.reason ?? undefined,
    notifiedAt: r.notified_at ?? undefined,
  };
}

/**
 * Loads the marking screen's starting state for one batch+date: the
 * session row if attendance was already taken (or marked holiday/
 * cancelled) for that day, and the list of student ids currently marked
 * absent. Returns session: null when attendance hasn't been touched yet
 * for this batch+date — the grid then opens as a blank present-by-default
 * slate rather than pre-populated (PRD §3.1).
 */
export async function loadAttendanceForBatch(
  batchId: string,
  sessionDate: string,
): Promise<{ session: AttendanceSession | null; absentStudentIds: string[] }> {
  const { data: sessionRow, error: sessionErr } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("batch_id", batchId)
    .eq("session_date", sessionDate)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!sessionRow) return { session: null, absentStudentIds: [] };

  const { data: absenceRows, error: absErr } = await supabase
    .from("attendance_absences")
    .select("student_id")
    .eq("session_id", sessionRow.id);
  if (absErr) throw absErr;

  return {
    session: toAttendanceSession(sessionRow),
    absentStudentIds: (absenceRows ?? []).map((r) => r.student_id),
  };
}

/**
 * Saves attendance for one batch+date via the save_attendance RPC — one
 * network round-trip regardless of absent count (PRD §6). Diffs against
 * whatever was there before the save (if anything) so the audit log entry
 * shows the actual old-absent-list → new-absent-list change, reusing the
 * same audit infrastructure as payment/student edits (PRD §7).
 */
export async function saveAttendance(
  batch: Pick<Batch, "id" | "name">,
  sessionDate: string,
  absentStudentIds: string[],
): Promise<AttendanceSession> {
  const before = await loadAttendanceForBatch(batch.id, sessionDate);

  const { data: sessionId, error } = await supabase.rpc("save_attendance", {
    _batch_id: batch.id,
    _session_date: sessionDate,
    _absent_student_ids: absentStudentIds,
  });
  if (error) throw error;

  const { data: row, error: fetchErr } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("id", sessionId as string)
    .single();
  if (fetchErr) throw fetchErr;
  const session = toAttendanceSession(row);

  logAudit({
    entity: "attendance",
    entityId: session.id,
    action: before.session ? "update" : "create",
    by: currentUser(),
    summary: `${before.session ? "Edited" : "Took"} attendance for ${batch.name} on ${sessionDate} · ${absentStudentIds.length} absent`,
    oldValue: before.session ? { absentStudentIds: before.absentStudentIds } : undefined,
    newValue: { absentStudentIds },
  });

  return session;
}

/** Marks a session as a holiday or cancelled lecture (PRD §7) — distinct
 *  from "taken", excluded from % calculations, carries no absence list. */
export async function markAttendanceStatus(
  batch: Pick<Batch, "id" | "name">,
  sessionDate: string,
  status: Extract<AttendanceSessionStatus, "holiday" | "cancelled">,
): Promise<AttendanceSession> {
  const { data: sessionId, error } = await supabase.rpc("mark_attendance_status", {
    _batch_id: batch.id,
    _session_date: sessionDate,
    _status: status,
  });
  if (error) throw error;

  const { data: row, error: fetchErr } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("id", sessionId as string)
    .single();
  if (fetchErr) throw fetchErr;
  const session = toAttendanceSession(row);

  logAudit({
    entity: "attendance",
    entityId: session.id,
    action: "update",
    by: currentUser(),
    summary: `Marked ${batch.name} on ${sessionDate} as ${status}`,
  });

  return session;
}

/**
 * Sessions within a date range, for the Attendance tab dashboard and
 * reports (daily/monthly views read straight off the denormalized
 * total_students/absent_count columns — no aggregation query needed).
 */
export async function listAttendanceSessions(
  fromDate: string,
  toDate: string,
  batchId?: string,
): Promise<AttendanceSession[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  let q = supabase
    .from("attendance_sessions")
    .select("*")
    .eq("institute_id", instId)
    .gte("session_date", fromDate)
    .lte("session_date", toDate)
    .order("session_date", { ascending: false });
  if (batchId) q = q.eq("batch_id", batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toAttendanceSession);
}

export interface AttendanceAbsenceRow extends AttendanceAbsence {
  sessionDate: string;
  batchId: string;
}

/**
 * Absence rows within a date range, flattened with their session's date
 * and batch (via an inner join on attendance_sessions, which is what
 * carries institute_id — attendance_absences itself has no institute_id
 * column, see the migration's RLS-scoping note). Used for student%/
 * batch%/top-absentees reports, computed client-side the same way
 * buildBatchFeeReportRows aggregates payments — no new DB views needed.
 */
export async function listAttendanceAbsences(
  fromDate: string,
  toDate: string,
  batchId?: string,
): Promise<AttendanceAbsenceRow[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  let q = supabase
    .from("attendance_absences")
    .select("*, attendance_sessions!inner(session_date, batch_id, institute_id)")
    .eq("attendance_sessions.institute_id", instId)
    .gte("attendance_sessions.session_date", fromDate)
    .lte("attendance_sessions.session_date", toDate);
  if (batchId) q = q.eq("attendance_sessions.batch_id", batchId);
  const { data, error } = await q;
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...toAttendanceAbsence(row),
    sessionDate: row.attendance_sessions.session_date,
    batchId: row.attendance_sessions.batch_id,
  }));
}

/** Absences for one specific session — the Notify list (Reports → batch →
 *  day) drills into a single day, so it only ever needs one session's rows. */
export async function listSessionAbsences(sessionId: string): Promise<AttendanceAbsence[]> {
  const { data, error } = await supabase
    .from("attendance_absences")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []).map(toAttendanceAbsence);
}

/** Marks one absence row as WhatsApp-notified. Server-side so the Notify
 *  list's sent/pending split survives a refresh or a different device —
 *  not just something remembered in React state for the current tab. */
export async function markAbsenceNotified(absenceId: string): Promise<void> {
  const { error } = await supabase
    .from("attendance_absences")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", absenceId);
  if (error) throw error;
}

export interface TodayAbsenceRow extends AttendanceAbsence {
  batchId: string;
}

/**
 * All of today's absences across EVERY batch in the institute, for the
 * Notify tab's flat table. Deliberately a separate function from
 * listAttendanceAbsences rather than reusing it with today/today as the
 * range — that function is designed around an optional single-batch
 * filter for the Reports drill-down; this one is always every batch,
 * always exactly `today`, no range or batch parameters, matching what
 * the Notify tab actually needs.
 */
export async function listTodayAbsencesForInstitute(today: string): Promise<TodayAbsenceRow[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const { data, error } = await supabase
    .from("attendance_absences")
    .select("*, attendance_sessions!inner(session_date, batch_id, institute_id)")
    .eq("attendance_sessions.institute_id", instId)
    .eq("attendance_sessions.session_date", today);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...toAttendanceAbsence(row),
    batchId: row.attendance_sessions.batch_id,
  }));
}

// ---- Expense Categories ----
function toExpenseCategory(r: any): ExpenseCategory {
  return {
    id: r.id,
    name: r.name,
    group: r.group_name,
    active: !!r.active,
    custom: !!r.custom,
  };
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("institute_id", instId)
    .order("group_name", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toExpenseCategory);
}

export async function addExpenseCategory(name: string, group = "Custom"): Promise<ExpenseCategory> {
  const instId = activeInstituteId();
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ institute_id: instId, name, group_name: group, custom: true })
    .select("*")
    .single();
  if (error) throw error;
  const cat = toExpenseCategory(data);
  logAudit({ entity: "category", entityId: cat.id, action: "create", by: currentUser(), summary: `Added expense category ${cat.name}` });
  return cat;
}

export async function renameExpenseCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("expense_categories").update({ name }).eq("id", id);
  if (error) throw error;
  logAudit({ entity: "category", entityId: id, action: "update", by: currentUser(), summary: `Renamed expense category to ${name}` });
}

export async function toggleExpenseCategory(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("expense_categories").update({ active }).eq("id", id);
  if (error) throw error;
  logAudit({ entity: "category", entityId: id, action: "update", by: currentUser(), summary: active ? "Activated category" : "Deactivated category" });
}

/** Throws a plain, user-facing message on the FK-violation case (category
 *  still referenced by expenses) instead of letting a raw Postgres error
 *  surface — callers should catch and toast this. */
export async function deleteExpenseCategory(id: string): Promise<void> {
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("This category has expenses recorded against it and can't be deleted. Deactivate it instead.");
    }
    throw error;
  }
  logAudit({ entity: "category", entityId: id, action: "delete", by: currentUser(), summary: "Deleted expense category" });
}

// ---- Expenses ----
function toExpense(r: any): Expense {
  return {
    id: r.id,
    instituteId: r.institute_id,
    date: r.date,
    categoryId: r.category_id,
    subCategory: r.sub_category ?? undefined,
    amount: Number(r.amount ?? 0),
    mode: r.mode as ExpensePaymentMode,
    vendor: r.vendor ?? undefined,
    description: r.description ?? undefined,
    attachmentName: r.attachment_name ?? undefined,
    createdAt: r.created_at,
    createdBy: r.created_by ?? "",
    updatedAt: r.updated_at ?? undefined,
    updatedBy: r.updated_by ?? undefined,
    deleted: !!r.deleted,
    deletedAt: r.deleted_at ?? undefined,
    deletedBy: r.deleted_by ?? undefined,
  };
}

export async function listExpenses(includeDeleted = false): Promise<Expense[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const q = supabase.from("expenses").select("*").eq("institute_id", instId).order("date", { ascending: false });
  const { data, error } = includeDeleted ? await q : await q.eq("deleted", false);
  if (error) throw error;
  return (data ?? []).map(toExpense);
}

export async function listDeletedExpenses(): Promise<Expense[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("institute_id", instId)
    .eq("deleted", true)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toExpense);
}

export async function createExpense(
  input: Omit<Expense, "id" | "instituteId" | "createdAt" | "createdBy">,
): Promise<Expense> {
  const instId = activeInstituteId();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      institute_id: instId,
      category_id: input.categoryId,
      date: input.date,
      sub_category: input.subCategory ?? null,
      amount: input.amount,
      mode: input.mode,
      vendor: input.vendor ?? null,
      description: input.description ?? null,
      attachment_name: input.attachmentName ?? null,
      created_by: getSession().userId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  const created = toExpense(data);
  logAudit({ entity: "expense", entityId: created.id, action: "create", by: currentUser(), summary: `Added expense ₹${created.amount}` });
  return created;
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .update({
      ...(patch.date !== undefined ? { date: patch.date } : {}),
      ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
      ...(patch.subCategory !== undefined ? { sub_category: patch.subCategory } : {}),
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
      ...(patch.vendor !== undefined ? { vendor: patch.vendor } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.attachmentName !== undefined ? { attachment_name: patch.attachmentName } : {}),
      updated_by: getSession().userId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
  logAudit({ entity: "expense", entityId: id, action: "update", by: currentUser(), summary: "Edited expense" });
}

export async function softDeleteExpense(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted: true, deleted_at: now, deleted_by: getSession().userId ?? null })
    .eq("id", id);
  if (error) throw error;
  logAudit({ entity: "expense", entityId: id, action: "delete", by: currentUser(), summary: "Moved expense to recycle bin" });
}

export async function restoreExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .update({ deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", id);
  if (error) throw error;
  logAudit({ entity: "expense", entityId: id, action: "restore", by: currentUser(), summary: "Restored expense" });
}

export async function purgeExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
  logAudit({ entity: "expense", entityId: id, action: "purge", by: currentUser(), summary: "Permanently deleted expense" });
}

// ---- Profitability ----
export type ProfitabilitySummary = {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
};

export async function getProfitabilitySummary(from: string, to: string): Promise<ProfitabilitySummary> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return { totalRevenue: 0, totalExpenses: 0, netProfit: 0, profitMarginPct: 0 };
  const { data, error } = await supabase
    .rpc("get_profitability_summary", { _institute: instId, _from: from, _to: to })
    .single();
  if (error) throw error;
  const row = data as any;
  return {
    totalRevenue: Number(row.total_revenue ?? 0),
    totalExpenses: Number(row.total_expenses ?? 0),
    netProfit: Number(row.net_profit ?? 0),
    profitMarginPct: Number(row.profit_margin_pct ?? 0),
  };
}

export type ExpenseCategoryBreakdown = {
  categoryId: string;
  categoryName: string;
  groupName: string;
  totalAmount: number;
};

export async function getExpenseBreakdownByCategory(from: string, to: string): Promise<ExpenseCategoryBreakdown[]> {
  const instId = activeInstituteIdOrNull();
  if (!instId) return [];
  const { data, error } = await supabase
    .rpc("get_expense_breakdown_by_category", { _institute: instId, _from: from, _to: to });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    groupName: row.group_name,
    totalAmount: Number(row.total_amount ?? 0),
  }));
}
