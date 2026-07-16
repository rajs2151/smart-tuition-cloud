import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MoreVertical, Pencil, Receipt as ReceiptIcon, MessageCircle, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { updatePayment, voidPayment } from "@/lib/data/adapter";
import { useSession } from "@/lib/auth/session";
import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";
import { getMessaging, logComm, markLogPaid } from "@/lib/messaging/store";
import type { Payment, Student } from "@/lib/data/types";

export function PaymentRowMenu({ payment, student }: { payment: Payment; student: Student | undefined }) {
  const qc = useQueryClient();
  const session = useSession();
  const isOwner = session.role === "owner";
  const [editOpen, setEditOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const sendWhatsAppReceipt = () => {
    if (!student) return;
    const { templates, defaults } = getMessaging();
    const billed = student.totalFee - student.discount;
    const pending = Math.max(0, billed - student.paidFee);
    const subType = pending === 0 ? "full" : payment.type === "admission" ? "admission" : "partial";
    const tpl =
      templates.find((t) => t.id === defaults.acknowledgement) ??
      templates.find((t) => t.category === "acknowledgement" && t.subType === subType) ??
      templates.find((t) => t.category === "acknowledgement");
    const mobile = pickMobile(student);
    if (!mobile) return toast.error("No mobile on file");
    if (!tpl) return toast.error("Configure an acknowledgement template in Settings");
    const msg = renderMessage(tpl, buildContext({ student, payment, pending }));
    openWhatsApp(mobile, msg);
    logComm({ studentId: student.id, studentName: student.name, mobile, templateId: tpl.id, templateName: tpl.name, category: "acknowledgement", message: msg, sentBy: "owner" });
    markLogPaid(student.id);
    toast.success("WhatsApp receipt opened");
  };

  const doVoid = async () => {
    try {
      await voidPayment(payment.id);
      toast.success("Payment voided");
      await qc.invalidateQueries({ refetchType: "all" });
      setVoidOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not void payment");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Payment actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isOwner && (
            <DropdownMenuItem disabled={payment.voided} onSelect={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit Payment
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/receipts/$id" params={{ id: payment.id }}>
              <ReceiptIcon className="h-4 w-4" /> Reprint Receipt
            </Link>
          </DropdownMenuItem>
          {!payment.voided && (
            <DropdownMenuItem onSelect={sendWhatsAppReceipt}>
              <MessageCircle className="h-4 w-4" /> Send WhatsApp Receipt
            </DropdownMenuItem>
          )}
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={payment.voided}
                onSelect={() => setVoidOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="h-4 w-4" /> {payment.voided ? "Already voided" : "Void Payment"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isOwner && <EditPaymentDialog payment={payment} open={editOpen} onOpenChange={setEditOpen} />}

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove it from fee calculations while preserving audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doVoid}>Void payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditPaymentDialog({ payment, open, onOpenChange }: {
  payment: Payment; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.date);
  const [mode, setMode] = useState<Payment["mode"]>(payment.mode);
  const [note, setNote] = useState(payment.note ?? "");

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");
    try {
      await updatePayment(payment.id, { amount: Number(amount), date, mode, note });
      toast.success("Payment updated");
      await qc.invalidateQueries({ refetchType: "all" });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update payment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payment · {payment.receiptNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payment mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Payment["mode"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Cash", "UPI", "Bank Transfer", "Card", "Cheque"] as const).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Installment 3 of 6" />
          </div>
          <p className="text-xs text-muted-foreground">
            Student and receipt number can't be changed here. Saving recalculates paid/outstanding amounts everywhere.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
