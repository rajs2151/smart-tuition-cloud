import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listBatches, listPayments, listStudents } from "@/lib/data/adapter";

/** Shared list keys — Dashboard, Fees, Students, header search, and
 *  Receive Payment all read the same cache instead of each fetching a
 *  private copy. */
export const studentsListQuery = {
  queryKey: ["students-list"] as const,
  queryFn: () => listStudents(),
};

export const paymentsListQuery = {
  queryKey: ["payments-list"] as const,
  queryFn: () => listPayments(),
};

export const batchesListQuery = {
  queryKey: ["batches-list"] as const,
  queryFn: () => listBatches(),
};

/** Attendance reports/notify need deleted students so historical absences
 *  still resolve to a name. Live lists stay on `students-list`. */
export const studentsInclDeletedQuery = {
  queryKey: ["students-list", "include-deleted"] as const,
  queryFn: () => listStudents(true),
};

export function useStudentsList() {
  return useQuery({ ...studentsListQuery, placeholderData: keepPreviousData });
}

export function usePaymentsList() {
  return useQuery({ ...paymentsListQuery, placeholderData: keepPreviousData });
}

export function useBatchesList() {
  return useQuery({ ...batchesListQuery, placeholderData: keepPreviousData });
}
