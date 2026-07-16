import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
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

const STUDENTS_QUERY_KEY = ["students-list"];

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
  const [open, setOpen] = useState(false);

  const { data: fetchedStudents } = useQuery({
    queryKey: STUDENTS_QUERY_KEY,
    queryFn: () => listStudents(),
    enabled: open && !studentsProp,
  });
  const students = studentsProp ?? fetchedStudents ?? [];

  const [studentId, setStudentId] = useState(defaultStudentId ?? "");

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

    const amountNum = Number(amount);
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
      toast.success(`Payment received · ${created.receiptNo}`);
      setOpen(false);
      setAmount("");
      setNote("");
      setPaymentDate(today);
      setDateError("");
      setDuplicateAckKey(null);

      // Force a real refetch of every cached query, not just active ones.
      // invalidateQueries() with no options defaults to refetchType:
      // "active" — any page not currently mounted (Dashboard, Student
      // List, Student Details opened from elsewhere, ...) would only be
      // flagged stale, and since their loaders use ensureQueryData (whose
      // revalidateIfStale option defaults to false), a merely-stale entry
      // is served as-is on the next visit with no network request. That's
      // what made Fee Summary/Dashboard totals/Student List progress look
      // frozen until a hard reload wiped the whole client cache. This is
      // the one place every payment-affecting mutation in the app goes
      // through the same fix (see also payment-row-menu.tsx,
      // import-students-dialog.tsx, recycle-bin.tsx) — no per-page wiring
      // to remember for whatever the next new page turns out to be.
      await qc.invalidateQueries({ refetchType: "all" });

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.rollNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
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
