import type { Batch, Payment, Student } from "./types";

export const batches: Batch[] = [
  { id: "b1", name: "JEE Advanced — 2026", course: "JEE", faculty: "Dr. R. Sharma", monthlyFee: 6000, strength: 42 },
  { id: "b2", name: "NEET Toppers Batch", course: "NEET", faculty: "Dr. S. Iyer", monthlyFee: 7000, strength: 38 },
  { id: "b3", name: "Class XII Science", course: "Board XII", faculty: "Mr. K. Joshi", monthlyFee: 3500, strength: 56 },
  { id: "b4", name: "MHT-CET Crash", course: "MHT-CET", faculty: "Ms. A. Patil", monthlyFee: 4500, strength: 29 },
  { id: "b5", name: "Foundation IX-X", course: "Foundation", faculty: "Mrs. P. Deshmukh", monthlyFee: 2500, strength: 64 },
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
  const totalFee = batch.monthlyFee * 12;
  const paidPct = rand();
  const paidFee = Math.round((totalFee * (0.2 + paidPct * 0.85)) / 500) * 500;
  const discount = rand() > 0.7 ? Math.round(rand() * 5) * 1000 : 0;
  const month = Math.floor(rand() * 8) + 1;
  const day = Math.floor(rand() * 28) + 1;
  return {
    id: `s${i + 1}`,
    rollNo: `DPC${(2025000 + i + 1).toString()}`,
    name: `${pick(firstNames)} ${pick(lastNames)}`,
    phone: `9${Math.floor(100000000 + rand() * 899999999)}`,
    parentPhone: `9${Math.floor(100000000 + rand() * 899999999)}`,
    email: `student${i + 1}@example.com`,
    batchId: batch.id,
    course: batch.course,
    admissionDate: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    totalFee,
    paidFee: Math.min(paidFee, totalFee - discount),
    discount,
    status: rand() > 0.95 ? "dropped" : "active",
    address: "Pune, Maharashtra",
  };
});

let receiptCounter = 1000;
export const payments: Payment[] = [];

for (const st of students) {
  let remaining = st.paidFee;
  let installments = Math.min(6, Math.max(1, Math.ceil(remaining / 8000)));
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
      studentId: st.id,
      amount: amt,
      date: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      mode: pick(["Cash", "UPI", "UPI", "Bank Transfer", "Card"] as const),
      receiptNo: `R-${++receiptCounter}`,
      type: "fee",
    });
    remaining -= amt;
    i++;
  }
}

payments.sort((a, b) => (a.date < b.date ? 1 : -1));
