import type { Batch, Payment, Student } from "./types";

const INSTITUTE_ID = "inst_default";

export const batches: Batch[] = [
  {
    id: "b1", instituteId: INSTITUTE_ID, name: "10th State Board Marathi - A",
    type: "standard", standard: "10th", board: "State Board", medium: "Marathi",
    faculty: "Mrs. P. Deshmukh", totalCourseFee: 36000, capacity: 60, active: true,
    startDate: "2025-06-01", endDate: "2026-03-31",
    course: "10th State Board",
  },
  {
    id: "b2", instituteId: INSTITUTE_ID, name: "10th CBSE English",
    type: "standard", standard: "10th", board: "CBSE", medium: "English",
    faculty: "Mr. K. Joshi", totalCourseFee: 42000, capacity: 50, active: true,
    startDate: "2025-06-01", endDate: "2026-03-31",
    course: "10th CBSE",
  },
  {
    id: "b3", instituteId: INSTITUTE_ID, name: "12th Science Morning",
    type: "standard", standard: "12th", board: "State Board", medium: "Semi English",
    faculty: "Dr. R. Sharma", totalCourseFee: 54000, capacity: 45, active: true,
    startDate: "2025-06-01", endDate: "2026-03-31",
    course: "12th Science",
  },
  {
    id: "b4", instituteId: INSTITUTE_ID, name: "JEE 2027 Foundation",
    type: "exam", examCategory: "JEE", examYear: 2027,
    faculty: "Dr. R. Sharma", totalCourseFee: 72000, capacity: 40, active: true,
    startDate: "2025-05-15", endDate: "2027-04-30",
    course: "JEE",
  },
  {
    id: "b5", instituteId: INSTITUTE_ID, name: "NEET 2027 Repeaters",
    type: "exam", examCategory: "NEET", examYear: 2027,
    faculty: "Dr. S. Iyer", totalCourseFee: 84000, capacity: 35, active: true,
    startDate: "2025-05-15", endDate: "2026-05-31",
    course: "NEET",
  },
];

const firstNames = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Saanvi", "Aadhya", "Pari", "Anika", "Navya", "Myra", "Sara", "Aanya", "Rohan", "Kabir", "Dhruv", "Atharv", "Ritika", "Tanvi", "Isha", "Riya", "Kavya", "Meera"];
const lastNames = ["Sharma", "Patil", "Joshi", "Deshmukh", "Kulkarni", "Iyer", "Nair", "Reddy", "Singh", "Verma", "Mehta", "Shah", "Gupta", "Rao", "Khan"];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seedRandom(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

export const students: Student[] = Array.from({ length: 48 }, (_, i) => {
  const batch = pick(batches);
  const courseFee = batch.totalCourseFee;
  const admissionFee = 2000;
  const totalFee = courseFee + admissionFee;
  const paidPct = rand();
  const paidFee = Math.round((totalFee * (0.2 + paidPct * 0.85)) / 500) * 500;
  const discount = rand() > 0.7 ? Math.round(rand() * 5) * 1000 : 0;
  const month = Math.floor(rand() * 8) + 1;
  const day = Math.floor(rand() * 28) + 1;
  const parent = `${pick(lastNames)} (Parent)`;
  return {
    id: `s${i + 1}`,
    instituteId: INSTITUTE_ID,
    rollNo: `DPC${(2025000 + i + 1).toString()}`,
    name: `${pick(firstNames)} ${pick(lastNames)}`,
    phone: `9${Math.floor(100000000 + rand() * 899999999)}`,
    parentName: parent,
    parentPhone: `9${Math.floor(100000000 + rand() * 899999999)}`,
    email: `student${i + 1}@example.com`,
    address: "Pune, Maharashtra",
    batchId: batch.id,
    standard: batch.standard,
    board: batch.board,
    medium: batch.medium,
    examCategory: batch.examCategory,
    course: batch.course,
    admissionDate: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    courseFee,
    admissionFee,
    totalFee,
    paidFee: Math.min(paidFee, totalFee - discount),
    discount,
    status: rand() > 0.95 ? "dropped" : "active",
  };
});

let receiptCounter = 1000;
export const payments: Payment[] = [];

for (const st of students) {
  let remaining = st.paidFee;
  const installments = Math.min(6, Math.max(1, Math.ceil(remaining / 8000)));
  let i = 0;
  while (remaining > 0 && i < installments) {
    const amt =
      i === installments - 1
        ? remaining
        : Math.round((remaining / (installments - i)) / 500) * 500;
    if (amt <= 0) break;
    const month = Math.max(1, Math.floor(rand() * 11) + 1);
    const day = Math.floor(rand() * 28) + 1;
    payments.push({
      id: `p${payments.length + 1}`,
      instituteId: INSTITUTE_ID,
      studentId: st.id,
      amount: amt,
      date: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      mode: pick(["Cash", "UPI", "UPI", "Bank Transfer", "Card"] as const),
      receiptNo: `REC-${++receiptCounter}`,
      type: "fee",
    });
    remaining -= amt;
    i++;
  }
}

payments.sort((a, b) => (a.date < b.date ? 1 : -1));
