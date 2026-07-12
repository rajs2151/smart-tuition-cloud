// All entities are tenant-scoped via instituteId so the same DB can serve
// multiple coaching institutes (super-admin / multi-tenant ready).

export type Standard =
  | "1st" | "2nd" | "3rd" | "4th" | "5th" | "6th"
  | "7th" | "8th" | "9th" | "10th" | "11th" | "12th";

export type Board = "State Board" | "CBSE" | (string & {});
export type Medium = "Marathi" | "Semi English" | "English" | (string & {});
export type ExamCategory = "JEE" | "NEET" | (string & {});

export type BatchType = "standard" | "exam";

export type Batch = {
  id: string;
  instituteId: string;
  name: string;
  type: BatchType;
  // For standard batches
  standard?: Standard;
  board?: Board;
  medium?: Medium;
  // For competitive exam batches
  examCategory?: ExamCategory;
  examYear?: number;
  // Common
  faculty?: string;
  totalCourseFee: number;
  capacity: number;
  startDate?: string; // ISO
  endDate?: string;   // ISO
  active: boolean;
  // legacy/display
  course?: string;
  strength?: number;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type Installment = {
  id: string;
  amount: number;
  dueDate: string; // ISO
  paid: boolean;
};

export type Student = {
  id: string;
  instituteId: string;
  rollNo: string;

  // Personal
  name: string;
  phone: string;
  parentName?: string;
  parentPhone?: string;
  email?: string;
  address?: string;
  photo?: string;
  dob?: string; // ISO

  // Academic
  batchId: string;
  standard?: Standard;
  board?: Board;
  medium?: Medium;
  examCategory?: ExamCategory;

  // Fees
  courseFee: number;          // base fee
  admissionFee: number;
  discount: number;
  totalFee: number;           // courseFee + admissionFee
  paidFee: number;
  installments?: Installment[];

  admissionDate: string;      // ISO
  status: "active" | "dropped" | "completed";

  // legacy
  course?: string;

  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type PaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Card" | "Cheque";

export type Payment = {
  id: string;
  instituteId: string;
  studentId: string;
  amount: number;
  date: string; // ISO
  mode: PaymentMode;
  receiptNo: string;
  note?: string;
  type: "fee" | "fine" | "advance" | "admission";

  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;

  voided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
};

export type Receipt = {
  id: string;
  instituteId: string;
  receiptNo: string;
  studentId: string;
  paymentId: string;
  amount: number;
  balance: number;
  date: string;
  mode: PaymentMode;
};

// ---- Institute / SaaS settings ----

export type InstituteProfile = {
  id: string;
  name: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  gstNumber?: string;
};

export type ReceiptConfig = {
  prefix: string;            // e.g. REC, FEE, INV
  nextNumber: number;
  footerText: string;
  termsAndConditions: string;
  authorizedSignatory: string;
  showGst: boolean;
  showLogo: boolean;
  showFooter: boolean;
};

export type MasterSettings = {
  standards: Standard[];
  boards: Board[];
  mediums: Medium[];
  examCategories: ExamCategory[];
};

export type AppSettings = {
  institute: InstituteProfile;
  receipt: ReceiptConfig;
  master: MasterSettings;
};
