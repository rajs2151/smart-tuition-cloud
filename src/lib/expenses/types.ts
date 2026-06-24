export type ExpensePaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Cheque";

export type ExpenseCategory = {
  id: string;
  name: string;
  group: string; // e.g. "Staff & Operations", "Infrastructure", "Custom"
  active: boolean;
  custom?: boolean;
};

export type Expense = {
  id: string;
  instituteId: string;
  date: string; // ISO yyyy-mm-dd
  categoryId: string;
  subCategory?: string;
  amount: number;
  mode: ExpensePaymentMode;
  vendor?: string;
  description?: string;
  attachmentName?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};
