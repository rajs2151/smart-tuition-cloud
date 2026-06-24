/**
 * Data adapter — single contract for the UI. Today this uses in-memory mock
 * data; swap the bodies to call your Google Apps Script web app (or Supabase)
 * without changing the components.
 *
 * Every record is tenant-scoped via instituteId so the same code can serve
 * multiple coaching institutes (super-admin / multi-tenant ready).
 */

import { batches, payments, students } from "./mock";
import type { Batch, Payment, Student } from "./types";
import { getSettings, nextReceiptNumber } from "@/lib/settings/store";
import { addRecycle, logAudit, removeRecycle } from "@/lib/audit/store";

const activeInstituteId = () => getSettings().institute.id;
const currentUser = () => "Owner";
const scoped = <T extends { instituteId?: string; deleted?: boolean }>(arr: T[], includeDeleted = false) => {
  const id = activeInstituteId();
  return arr.filter((r) => (!r.instituteId || r.instituteId === id || r.instituteId === "inst_default") && (includeDeleted || !r.deleted));
};

// --- Students ---
export async function listStudents(includeDeleted = false): Promise<Student[]> {
  return scoped(students, includeDeleted);
}
export async function getStudent(id: string): Promise<Student | undefined> {
  return students.find((s) => s.id === id);
}
export async function createStudent(s: Omit<Student, "id" | "instituteId">): Promise<Student> {
  const created: Student = { ...s, id: `s${Date.now()}`, instituteId: activeInstituteId() };
  students.unshift(created);
  logAudit({ entity: "student", entityId: created.id, action: "create", by: currentUser(), summary: `Admitted ${created.name}` });
  return created;
}
export async function updateStudent(id: string, patch: Partial<Student>) {
  const i = students.findIndex((s) => s.id === id);
  if (i < 0) throw new Error("Student not found");
  students[i] = { ...students[i], ...patch };
  logAudit({ entity: "student", entityId: id, action: "update", by: currentUser(), summary: `Updated ${students[i].name}` });
  return students[i];
}
export async function deleteStudent(id: string) {
  const i = students.findIndex((s) => s.id === id);
  if (i < 0) return;
  students[i] = { ...students[i], deleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser() };
  addRecycle({ entity: "student", entityId: id, label: students[i].name, deletedAt: students[i].deletedAt!, deletedBy: currentUser() });
  logAudit({ entity: "student", entityId: id, action: "delete", by: currentUser(), summary: `Moved ${students[i].name} to recycle bin` });
}
export async function restoreStudent(id: string) {
  const i = students.findIndex((s) => s.id === id);
  if (i < 0) return;
  students[i] = { ...students[i], deleted: false, deletedAt: undefined, deletedBy: undefined };
  removeRecycle("student", id);
  logAudit({ entity: "student", entityId: id, action: "restore", by: currentUser(), summary: `Restored ${students[i].name}` });
}
export async function purgeStudent(id: string) {
  const i = students.findIndex((s) => s.id === id);
  if (i < 0) return;
  const name = students[i].name;
  students.splice(i, 1);
  removeRecycle("student", id);
  logAudit({ entity: "student", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted ${name}` });
}

// --- Batches ---
export async function listBatches(includeDeleted = false): Promise<Batch[]> {
  return scoped(batches, includeDeleted);
}
export async function createBatch(b: Omit<Batch, "id" | "instituteId">): Promise<Batch> {
  const created: Batch = { ...b, id: `b${Date.now()}`, instituteId: activeInstituteId() };
  batches.push(created);
  logAudit({ entity: "batch", entityId: created.id, action: "create", by: currentUser(), summary: `Created batch ${created.name}` });
  return created;
}
export async function updateBatch(id: string, patch: Partial<Batch>): Promise<Batch> {
  const i = batches.findIndex((b) => b.id === id);
  if (i < 0) throw new Error("Batch not found");
  batches[i] = { ...batches[i], ...patch };
  logAudit({ entity: "batch", entityId: id, action: "update", by: currentUser(), summary: `Updated batch ${batches[i].name}` });
  return batches[i];
}
export async function deleteBatch(id: string): Promise<void> {
  const i = batches.findIndex((b) => b.id === id);
  if (i < 0) return;
  batches[i] = { ...batches[i], deleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser() };
  addRecycle({ entity: "batch", entityId: id, label: batches[i].name, deletedAt: batches[i].deletedAt!, deletedBy: currentUser() });
  logAudit({ entity: "batch", entityId: id, action: "delete", by: currentUser(), summary: `Moved batch ${batches[i].name} to recycle bin` });
}
export async function restoreBatch(id: string) {
  const i = batches.findIndex((b) => b.id === id);
  if (i < 0) return;
  batches[i] = { ...batches[i], deleted: false, deletedAt: undefined, deletedBy: undefined };
  removeRecycle("batch", id);
  logAudit({ entity: "batch", entityId: id, action: "restore", by: currentUser(), summary: `Restored batch ${batches[i].name}` });
}
export async function purgeBatch(id: string) {
  const i = batches.findIndex((b) => b.id === id);
  if (i < 0) return;
  const name = batches[i].name;
  batches.splice(i, 1);
  removeRecycle("batch", id);
  logAudit({ entity: "batch", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted batch ${name}` });
}

// --- Payments ---
export async function listPayments(includeDeleted = false): Promise<Payment[]> {
  return scoped(payments, includeDeleted);
}
export async function listPaymentsByStudent(studentId: string): Promise<Payment[]> {
  return payments.filter((p) => p.studentId === studentId && !p.deleted);
}
export async function recordPayment(
  input: Omit<Payment, "id" | "receiptNo" | "instituteId">,
): Promise<Payment> {
  const receiptNo = nextReceiptNumber();
  const created: Payment = { ...input, id: `p${Date.now()}`, receiptNo, instituteId: activeInstituteId() };
  payments.unshift(created);
  const st = students.find((s) => s.id === input.studentId);
  if (st) st.paidFee = Math.min(st.totalFee - st.discount, st.paidFee + input.amount);
  logAudit({ entity: "payment", entityId: created.id, action: "create", by: currentUser(), summary: `Recorded payment ${created.receiptNo} (₹${created.amount})` });
  return created;
}
export async function updatePayment(id: string, patch: Partial<Payment>) {
  const i = payments.findIndex((p) => p.id === id);
  if (i < 0) throw new Error("Payment not found");
  const before = payments[i];
  const after = { ...before, ...patch };
  payments[i] = after;
  // Reconcile student paidFee if amount changed
  if (patch.amount !== undefined && patch.amount !== before.amount) {
    const st = students.find((s) => s.id === after.studentId);
    if (st) st.paidFee = Math.max(0, st.paidFee - before.amount + after.amount);
  }
  logAudit({ entity: "payment", entityId: id, action: "update", by: currentUser(), summary: `Edited payment ${after.receiptNo}` });
  return after;
}
export async function deletePayment(id: string) {
  const i = payments.findIndex((p) => p.id === id);
  if (i < 0) return;
  const p = payments[i];
  payments[i] = { ...p, deleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser() };
  // reverse student balance
  const st = students.find((s) => s.id === p.studentId);
  if (st) st.paidFee = Math.max(0, st.paidFee - p.amount);
  addRecycle({ entity: "payment", entityId: id, label: `${p.receiptNo} · ₹${p.amount}`, deletedAt: payments[i].deletedAt!, deletedBy: currentUser() });
  logAudit({ entity: "payment", entityId: id, action: "delete", by: currentUser(), summary: `Moved payment ${p.receiptNo} to recycle bin` });
}
export async function restorePayment(id: string) {
  const i = payments.findIndex((p) => p.id === id);
  if (i < 0) return;
  const p = payments[i];
  payments[i] = { ...p, deleted: false, deletedAt: undefined, deletedBy: undefined };
  const st = students.find((s) => s.id === p.studentId);
  if (st) st.paidFee = Math.min(st.totalFee - st.discount, st.paidFee + p.amount);
  removeRecycle("payment", id);
  logAudit({ entity: "payment", entityId: id, action: "restore", by: currentUser(), summary: `Restored payment ${p.receiptNo}` });
}
export async function purgePayment(id: string) {
  const i = payments.findIndex((p) => p.id === id);
  if (i < 0) return;
  const rec = payments[i].receiptNo;
  payments.splice(i, 1);
  removeRecycle("payment", id);
  logAudit({ entity: "payment", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted payment ${rec}` });
}
