import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listPaymentsByStudent, listStudents, recordPayment } from "@/lib/data/adapter";
import { todayLocalISO } from "@/lib/format";
import type { Payment, Student } from "@/lib/data/types";
import { studentsListQuery } from "@/lib/query/lists";
import { invalidateAfterPayment, prependPayment } from "@/lib/query/invalidate";
import { FEE_LIMITS, clampFee } from "@/lib/validation/input-rules";

const STUDENTS_QUERY_KEY = studentsListQuery.queryKey;
const MATCH_LIMIT = 8;

function studentMatches(student: Student, query: string): boolean {
  const name = student.name.toLowerCase();
  const roll = student.rollNo.toLowerCase();
  const phone = (student.phone ?? "").replace(/\D/g, "");
  const digits = query.replace(/\D/g, "");
  return (
    name.includes(query) || roll.includes(query) || (digits.length >= 3 && phone.includes(digits))
  );
}

/** Type-to-find student field. A native input (not a dropdown) so a phone
 *  opens its keyboard. Matches stay inside the dialog: a second popup would
 *  sit outside the dialog's focus trap and the keyboard would not appear. */
function StudentSearch({
  open,
  students,
  studentId,
  onSelect,
}: {
  open: boolean;
  students: Student[];
  studentId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const selected = students.find((s) => s.id === studentId) ?? null;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEditing(false);
  }, [open]);

  const shown = editing ? query : (selected?.name ?? "");
  const needle = shown.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!editing || needle.length === 0) return [];
    return students
      .filter((s) => studentMatches(s, needle))
      .sort(
        (a, b) =>
          Number(b.name.toLowerCase().startsWith(needle)) -
            Number(a.name.toLowerCase().startsWith(needle)) || a.name.localeCompare(b.name),
      )
      .slice(0, MATCH_LIMIT);
  }, [students, editing, needle]);
  const hidden = useMemo(() => {
    if (!editing || needle.length === 0) return 0;
    return students.filter((s) => studentMatches(s, needle)).length - matches.length;
  }, [students, editing, needle, matches.length]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="payment-student">Student</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="payment-student"
          value={shown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
          placeholder="Type a name, roll no or phone"
          className="h-11 pl-9 text-base"
          onFocus={() => {
            if (editing) return;
            setEditing(true);
            setQuery(selected?.name ?? "");
          }}
          onChange={(e) => {
            setEditing(true);
            setQuery(e.target.value);
            if (studentId) onSelect("");
          }}
        />
      </div>
      {selected && !editing && (
        <p className="text-xs text-muted-foreground">
          Selected{selected.rollNo ? ` · roll ${selected.rollNo}` : ""}
          {selected.standard ? ` · ${selected.standard}` : ""}
        </p>
      )}
      {editing && needle.length === 0 && (
        <p className="text-xs text-muted-foreground">Type a few letters of the student's name.</p>
      )}
      {editing && needle.length > 0 && (
        <ul
          role="listbox"
          aria-label="Matching students"
          className="max-h-52 overflow-y-auto rounded-md border"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              No student matches “{shown.trim()}”.
            </li>
          ) : (
            matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(s.id);
                    setEditing(false);
                    setQuery("");
                  }}
                >
                  <span className="min-w-0 truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.rollNo}
                    {s.standard ? ` · ${s.standard}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
          {hidden > 0 && (
            <li className="px-3 py-2 text-center text-xs text-muted-foreground">
              {hidden} more — type another letter to narrow the list
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * The one Receive Payment dialog used everywhere a payment can be
 * recorded (Fees page, Student Details page, ...). Do not fork this —
 * pages that need it should import it from here.
 */
export function RecordPaymentDialog({
  defaultStudentId,
  students: studentsProp,
  payments: paymentsProp,
  trigger,
  onRecorded,
}: {
  defaultStudentId?: string;
  /** Pass this when the caller already has a student list loaded (e.g. the Fees
   *  page) to avoid a redundant fetch. Omit it and the dialog fetches its own,
   *  lazily, only while open — e.g. from the Student Details page. */
  students?: Student[];
  /** Recent payments to check for accidental duplicates against. Pass the
   *  full institute list (Fees page) or just the one student's own payments
   *  (Student Details page, where defaultStudentId is fixed) — either works,
   *  since the duplicate check is always scoped to the selected student. */
  payments?: Payment[];
  trigger?: React.ReactNode;
  onRecorded?: (payment: Payment) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: fetchedStudents } = useQuery({
    queryKey: STUDENTS_QUERY_KEY,
    queryFn: () => listStudents(),
    enabled: open && !studentsProp,
  });
  const students = studentsProp ?? fetchedStudents ?? [];

  const [studentId, setStudentId] = useState(defaultStudentId ?? "");
  const amountRef = useRef<HTMLInputElement>(null);

  const { data: fetchedPayments } = useQuery({
    queryKey: ["payments-for-student", studentId],
    queryFn: () => listPaymentsByStudent(studentId),
    enabled: open && !paymentsProp && !!studentId,
  });
  const payments = paymentsProp ?? fetchedPayments ?? [];

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Payment["mode"]>("UPI");
  const [note, setNote] = useState("");
  const today = todayLocalISO();
  const [paymentDate, setPaymentDate] = useState(today);
  const [dateError, setDateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Tracks which exact (student, amount, mode, date) combination the user
  // has already been warned about and chosen to save anyway. Any change to
  // those fields invalidates the previous acknowledgement, so a new
  // combination always gets checked fresh.
  const [duplicateAckKey, setDuplicateAckKey] = useState<string | null>(null);

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) setStudentId(defaultStudentId ?? "");
  };

  const onDateChange = (v: string) => {
    setPaymentDate(v);
    if (!v) setDateError("Payment date is required");
    else if (v > today) setDateError("Payment date cannot be in the future");
    else setDateError("");
  };

  const submit = async () => {
    if (submitting) return; // re-entrancy guard: ignore rapid double-clicks/taps
    if (!studentId || !amount) return toast.error("Pick a student and enter amount");
    if (!paymentDate) {
      setDateError("Payment date is required");
      return toast.error("Payment date is required");
    }
    if (paymentDate > today) {
      setDateError("Payment date cannot be in the future");
      return toast.error("Payment date cannot be in the future");
    }

    const amountNum = clampFee(Number(amount), FEE_LIMITS.payment.min, FEE_LIMITS.payment.max);
    if (!Number.isFinite(Number(amount)) || Number(amount) < FEE_LIMITS.payment.min) {
      return toast.error("Enter a realistic payment amount (at least ₹1)");
    }
    if (Number(amount) > FEE_LIMITS.payment.max) {
      return toast.error("Payment amount looks too high (max ₹5,00,000). Check and try again.");
    }
    const existing = payments.find(
      (p) =>
        p.studentId === studentId &&
        !p.voided &&
        p.amount === amountNum &&
        p.mode === mode &&
        p.date === paymentDate,
    );
    const key = `${studentId}|${amountNum}|${mode}|${paymentDate}`;
    if (existing && duplicateAckKey !== key) {
      toast.error(
        `A payment of ₹${amountNum} via ${mode} was already recorded for this student on this date (${existing.receiptNo}). Click Save again to record this as a separate payment anyway.`,
      );
      setDuplicateAckKey(key);
      return;
    }

    setSubmitting(true);
    try {
      const created = await recordPayment({
        studentId,
        amount: amountNum,
        mode,
        date: paymentDate,
        note,
        type: "fee",
      });
      toast.success(`Payment received · ${created.receiptNo}`, {
        action: {
          label: "View Receipt",
          onClick: () => navigate({ to: "/receipts/$id", params: { id: created.id } }),
        },
      });
      setOpen(false);
      setAmount("");
      setNote("");
      setPaymentDate(today);
      setDateError("");
      setDuplicateAckKey(null);

      prependPayment(qc, created);
      await invalidateAfterPayment(qc);

      onRecorded?.(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Receive Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // Focus the field the teacher will type into, while the tap that
          // opened the dialog is still recent, so the phone keyboard appears.
          e.preventDefault();
          const target = defaultStudentId
            ? amountRef.current
            : document.getElementById("payment-student");
          target?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <StudentSearch
            open={open}
            students={students}
            studentId={studentId}
            onSelect={setStudentId}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                ref={amountRef}
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min={FEE_LIMITS.payment.min}
                max={FEE_LIMITS.payment.max}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Payment["mode"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Cash", "UPI", "Bank Transfer", "Card", "Cheque"] as const).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentDate}
              max={today}
              onChange={(e) => onDateChange(e.target.value)}
              aria-invalid={!!dateError}
            />
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Installment 3 of 6"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save & generate receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
