import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, IndianRupee, MessageCircle } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { listPayments, listStudents, recordPayment } from "@/lib/data/adapter";
import { fmtDate, initials, inr } from "@/lib/format";
import type { Payment } from "@/lib/data/types";
import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";
import { getMessaging, logComm, markLogPaid } from "@/lib/messaging/store";
import { PaymentRowMenu } from "@/components/payment-row-menu";

const q = {
  queryKey: ["fees-page"],
  queryFn: async () => ({
    students: await listStudents(),
    payments: await listPayments(),
  }),
};

export const Route = createFileRoute("/fees")({
  head: () => ({
    meta: [
      { title: "Fees — Vidyafee" },
      { name: "description", content: "Track collections, record payments and follow up on pending dues." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: FeesPage,
});

function FeesPage() {
  const { data } = useSuspenseQuery(q);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "due" | "paid">("all");

  const enriched = useMemo(() => {
    return data.students
      .map((s) => {
        const billed = s.totalFee - s.discount;
        const due = Math.max(0, billed - s.paidFee);
        return { ...s, billed, due };
      })
      .filter((s) => {
        if (tab === "due" && s.due === 0) return false;
        if (tab === "paid" && s.due > 0) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q);
      })
      .sort((a, b) => b.due - a.due);
  }, [data.students, search, tab]);

  const totals = useMemo(() => {
    const billed = data.students.reduce((a, s) => a + (s.totalFee - s.discount), 0);
    const collected = data.students.reduce((a, s) => a + s.paidFee, 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayCol = data.payments.filter((p) => p.date === today && !p.voided).reduce((a, p) => a + p.amount, 0);
    return { billed, collected, due: billed - collected, todayCol };
  }, [data]);

  return (
    <>
      <AppHeader
        title="Fee Management"
        subtitle="Track collections, dues and record new payments"
        actions={<RecordPaymentDialog />}
      />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Total billed" value={inr(totals.billed)} />
          <MiniStat label="Collected" value={inr(totals.collected)} tone="success" />
          <MiniStat label="Outstanding" value={inr(totals.due)} tone="danger" />
          <MiniStat label="Today's collection" value={inr(totals.todayCol)} tone="info" />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="due">With dues</TabsTrigger>
                <TabsTrigger value="paid">Cleared</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="divide-y">
            {enriched.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:gap-4 md:px-5">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">{initials(s.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link to="/students/$id" params={{ id: s.id }} className="font-medium hover:underline">{s.name}</Link>
                  <p className="text-xs text-muted-foreground">{s.rollNo} · {s.course}</p>
                </div>
                <div className="hidden md:block text-right">
                  <p className="text-xs text-muted-foreground">Billed</p>
                  <p className="font-display font-semibold">{inr(s.billed)}</p>
                </div>
                <div className="hidden md:block text-right">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-display font-semibold text-success">{inr(s.paidFee)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Due</p>
                  <p className={`font-display font-bold ${s.due > 0 ? "text-destructive" : "text-success"}`}>
                    {s.due > 0 ? inr(s.due) : "Cleared"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.due > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      title="Send WhatsApp reminder"
                      onClick={(e) => {
                        e.preventDefault();
                        const { templates, defaults } = getMessaging();
                        const tpl = templates.find((t) => t.id === defaults.reminder) ?? templates.find((t) => t.category === "reminder");
                        const mobile = pickMobile(s);
                        if (!mobile) return toast.error("No mobile on file");
                        if (!tpl) return toast.error("Configure a reminder template in Settings");
                        const msg = renderMessage(tpl, buildContext({ student: s, pending: s.due }));
                        openWhatsApp(mobile, msg);
                        logComm({ studentId: s.id, studentName: s.name, mobile, templateId: tpl.id, templateName: tpl.name, category: "reminder", message: msg, sentBy: "owner" });
                        toast.success("WhatsApp reminder opened");
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <RecordPaymentDialog defaultStudentId={s.id} trigger={
                    <Button size="sm" title="Receive payment"><IndianRupee className="h-4 w-4" /> Receive Payment</Button>
                  } />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.payments.slice(0, 8).map((p) => {
              const st = data.students.find((s) => s.id === p.studentId);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent/50 ${p.voided ? "opacity-60" : ""}`}
                >
                  <Link to="/receipts/$id" params={{ id: p.id }} className="flex-1">
                    <p className="text-sm font-medium">{st?.name}</p>
                    <p className="text-xs text-muted-foreground">{p.receiptNo} · {fmtDate(p.date)}</p>
                  </Link>
                  <div className="flex items-center gap-3">
                    {p.voided && <Badge variant="destructive">Voided</Badge>}
                    <Badge variant="secondary">{p.mode}</Badge>
                    <span className={`font-display font-bold ${p.voided ? "text-muted-foreground line-through" : "text-success"}`}>
                      +{inr(p.amount)}
                    </span>
                    <PaymentRowMenu payment={p} student={st} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | "info" }) {
  const cls =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "info" ? "text-info" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 font-display text-xl font-bold ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RecordPaymentDialog({
  defaultStudentId,
  trigger,
}: {
  defaultStudentId?: string;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(q);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(defaultStudentId ?? "");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Payment["mode"]>("UPI");
  const [note, setNote] = useState("");

  const submit = async () => {
    if (!studentId || !amount) return toast.error("Pick a student and enter amount");
    const created = await recordPayment({
      studentId,
      amount: Number(amount),
      mode,
      date: new Date().toISOString().slice(0, 10),
      note,
      type: "fee",
    });
    toast.success(`Payment received · ${created.receiptNo}`);
    setOpen(false);
    setAmount("");
    setNote("");
    await qc.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button><Plus className="h-4 w-4" /> Receive Payment</Button>
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
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {data.students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} · {s.rollNo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Payment["mode"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Cash", "UPI", "Bank Transfer", "Card", "Cheque"] as const).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Installment 3 of 6" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Save & generate receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
