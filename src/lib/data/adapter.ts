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

const activeInstituteId = () => getSettings().institute.id;

// --- Students ---
export async function listStudents(): Promise<Student[]> {
  const id = activeInstituteId();
  return students.filter((s) => !s.instituteId || s.instituteId === id || s.instituteId === "inst_default");
}
export async function getStudent(id: string): Promise<Student | undefined> {
  return students.find((s) => s.id === id);
}
export async function createStudent(s: Omit<Student, "id" | "instituteId">): Promise<Student> {
  const created: Student = {
    ...s,
    id: `s${Date.now()}`,
    instituteId: activeInstituteId(),
  };
  students.unshift(created);
  return created;
}
export async function updateStudent(id: string, patch: Partial<Student>) {
  const i = students.findIndex((s) => s.id === id);
  if (i < 0) throw new Error("Student not found");
  students[i] = { ...students[i], ...patch };
  return students[i];
}

// --- Batches ---
export async function listBatches(): Promise<Batch[]> {
  const id = activeInstituteId();
  return batches.filter((b) => !b.instituteId || b.instituteId === id || b.instituteId === "inst_default");
}
export async function createBatch(b: Omit<Batch, "id" | "instituteId">): Promise<Batch> {
  const created: Batch = { ...b, id: `b${Date.now()}`, instituteId: activeInstituteId() };
  batches.push(created);
  return created;
}
export async function updateBatch(id: string, patch: Partial<Batch>): Promise<Batch> {
  const i = batches.findIndex((b) => b.id === id);
  if (i < 0) throw new Error("Batch not found");
  batches[i] = { ...batches[i], ...patch };
  return batches[i];
}
export async function deleteBatch(id: string): Promise<void> {
  const i = batches.findIndex((b) => b.id === id);
  if (i >= 0) batches.splice(i, 1);
}

// --- Payments ---
export async function listPayments(): Promise<Payment[]> {
  const id = activeInstituteId();
  return payments.filter((p) => !p.instituteId || p.instituteId === id || p.instituteId === "inst_default");
}
export async function listPaymentsByStudent(studentId: string): Promise<Payment[]> {
  return payments.filter((p) => p.studentId === studentId);
}
export async function recordPayment(
  input: Omit<Payment, "id" | "receiptNo" | "instituteId">,
): Promise<Payment> {
  const receiptNo = nextReceiptNumber();
  const created: Payment = {
    ...input,
    id: `p${Date.now()}`,
    receiptNo,
    instituteId: activeInstituteId(),
  };
  payments.unshift(created);
  const st = students.find((s) => s.id === input.studentId);
  if (st) st.paidFee = Math.min(st.totalFee - st.discount, st.paidFee + input.amount);
  return created;
}
