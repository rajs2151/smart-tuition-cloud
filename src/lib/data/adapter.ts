/**
 * Data adapter.
 *
 * The UI talks only to this module — never to mock arrays or Google Sheets
 * directly. To migrate to Google Sheets / Supabase / Firebase, swap the
 * implementations below. The function signatures are the contract.
 *
 * ---- Google Sheets via Apps Script (later) ----
 * 1. Publish a Google Apps Script Web App that exposes:
 *      doGet(e)  -> JSON for ?op=listStudents, etc.
 *      doPost(e) -> JSON for { op: "addPayment", payload: {...} }
 * 2. Set VITE_SHEETS_API_URL in .env to the web-app URL.
 * 3. Replace the bodies of these functions with `fetch(SHEETS_URL, ...)`.
 *    Keep return shapes identical.
 */

import { batches, payments, students } from "./mock";
import type { Batch, Payment, Student } from "./types";

// --- Students ---
export async function listStudents(): Promise<Student[]> {
  return [...students];
}
export async function getStudent(id: string): Promise<Student | undefined> {
  return students.find((s) => s.id === id);
}
export async function createStudent(s: Omit<Student, "id">): Promise<Student> {
  const created: Student = { ...s, id: `s${students.length + 1}` };
  students.push(created);
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
  return [...batches];
}

// --- Payments ---
export async function listPayments(): Promise<Payment[]> {
  return [...payments];
}
export async function listPaymentsByStudent(studentId: string): Promise<Payment[]> {
  return payments.filter((p) => p.studentId === studentId);
}
export async function recordPayment(
  input: Omit<Payment, "id" | "receiptNo">,
): Promise<Payment> {
  const receiptNo = `R-${1000 + payments.length + 1}`;
  const created: Payment = { ...input, id: `p${payments.length + 1}`, receiptNo };
  payments.unshift(created);
  // Update student's paid fee
  const st = students.find((s) => s.id === input.studentId);
  if (st) st.paidFee = Math.min(st.totalFee - st.discount, st.paidFee + input.amount);
  return created;
}
