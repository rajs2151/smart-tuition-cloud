import type { QueryClient } from "@tanstack/react-query";
import type { Payment } from "@/lib/data/types";
import { paymentsListQuery, studentsListQuery, batchesListQuery } from "./lists";

/** After a payment insert/edit/void. Does not touch expenses, messaging, or attendance sessions. */
export async function invalidateAfterPayment(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: paymentsListQuery.queryKey }),
    qc.invalidateQueries({ queryKey: studentsListQuery.queryKey }),
    qc.invalidateQueries({ queryKey: ["payments-for-student"] }),
    qc.invalidateQueries({ queryKey: ["student"] }),
    qc.invalidateQueries({ queryKey: ["receipt"] }),
  ]);
}

/** After admit / edit / archive / restore of a student. */
export async function invalidateAfterStudent(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: studentsListQuery.queryKey }),
    qc.invalidateQueries({ queryKey: ["students-list", "include-deleted"] }),
    qc.invalidateQueries({ queryKey: ["student"] }),
    qc.invalidateQueries({ queryKey: ["deleted-students"] }),
    qc.invalidateQueries({ queryKey: ["audit-logs"] }),
  ]);
}

/** After batch create / edit / delete / restore. */
export async function invalidateAfterBatch(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: batchesListQuery.queryKey }),
    qc.invalidateQueries({ queryKey: studentsListQuery.queryKey }),
    qc.invalidateQueries({ queryKey: ["students-list", "include-deleted"] }),
    qc.invalidateQueries({ queryKey: ["deleted-batches"] }),
    qc.invalidateQueries({ queryKey: ["audit-logs"] }),
  ]);
}

export async function invalidateAfterStudentImport(qc: QueryClient) {
  await Promise.all([
    invalidateAfterStudent(qc),
    invalidateAfterPayment(qc),
  ]);
}

/** Show the new row immediately, then refetch so receipt numbers / paidFee stay honest. */
export function prependPayment(qc: QueryClient, payment: Payment) {
  qc.setQueryData<Payment[]>(paymentsListQuery.queryKey, (old) =>
    old ? [payment, ...old.filter((p) => p.id !== payment.id)] : [payment],
  );
}
