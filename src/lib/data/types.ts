export type Batch = {
  id: string;
  name: string;
  course: string;
  faculty: string;
  monthlyFee: number;
  strength: number;
};

export type Student = {
  id: string;
  rollNo: string;
  name: string;
  phone: string;
  parentPhone?: string;
  email?: string;
  photo?: string;
  batchId: string;
  course: string;
  admissionDate: string; // ISO
  totalFee: number;
  paidFee: number;
  discount: number;
  status: "active" | "dropped" | "completed";
  address?: string;
};

export type Payment = {
  id: string;
  studentId: string;
  amount: number;
  date: string; // ISO
  mode: "Cash" | "UPI" | "Bank Transfer" | "Card" | "Cheque";
  receiptNo: string;
  note?: string;
  type: "fee" | "fine" | "advance";
};

export type Receipt = {
  id: string;
  receiptNo: string;
  studentId: string;
  paymentId: string;
  amount: number;
  balance: number;
  date: string;
  mode: Payment["mode"];
};
