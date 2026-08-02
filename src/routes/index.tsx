import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  IndianRupee,
  TrendingUp,
  Users,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Bell,
  MessageCircle,
  Receipt as ReceiptIcon,
  UserPlus,
  Sparkles,
  FileBarChart,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AddStudentDialog } from "@/components/add-student-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listBatches, listPayments, listStudents } from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";
import { fmtDate, initials, inr, inrShort } from "@/lib/format";
import { getMessaging } from "@/lib/messaging/store";
import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";

const dashboardQuery = {
  queryKey: ["dashboard"],
  queryFn: async () => {
    const [students, payments, batches] = await Promise.all([
      listStudents(),
      listPayments(),
      listBatches(),
    ]);
    return { students, payments, batches };
  },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vidyafee" },
      { name: "description", content: "Live overview of collections, dues and admissions for your institute." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { institute } = useSettings();
  const { students, payments, batches } = data;

  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpThreshold, setFollowUpThreshold] = useState(40);

  // Collected is derived from the payments ledger (already loaded on this
  // page), not from the cached student.paidFee column. That column is
  // reconciled by a best-effort background step after each payment; if it
  // ever fails silently, paidFee can drift out of sync with the actual
  // ledger while payments itself stays correct. Same fix as Fees list,
  // Batch Fee Report, and Student Details, so every screen agrees.
  const collectedByStudent = new Map<string, number>();
  for (const p of payments) {
    if (p.voided) continue;
    collectedByStudent.set(p.studentId, (collectedByStudent.get(p.studentId) ?? 0) + p.amount);
  }
  const collectedFor = (studentId: string) => collectedByStudent.get(studentId) ?? 0;

  const totalBilled = students.reduce((a, s) => a + (s.totalFee - s.discount), 0);
  const totalCollected = payments.filter((p) => !p.voided).reduce((a, p) => a + p.amount, 0);
  const pending = Math.max(0, totalBilled - totalCollected);
  const collectionRate = totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const activeStudents = students.filter((s) => s.status === "active").length;
  const activeBatches = batches.filter((b) => b.active !== false).length;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = payments
    .filter((p) => !p.voided && p.date.startsWith(thisMonth))
    .reduce((a, p) => a + p.amount, 0);

  // monthly trend (last 8 months, ending this month)
  const months: { m: string; collected: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const collected = payments
      .filter((p) => !p.voided && p.date.startsWith(key))
      .reduce((a, p) => a + p.amount, 0);
    months.push({ m: d.toLocaleString("en-IN", { month: "short" }), collected });
  }
  const hasTrendData = months.some((m) => m.collected > 0);

  // per-student % collected — the one place this is computed, reused by
  // both "Top pending dues" / the Pending Fees modal and the new Students
  // Needing Follow-up card below, so there's no second definition of
  // "how much has this student paid" anywhere on this page.
  const withProgress = students.map((s) => {
    const billed = s.totalFee - s.discount;
    const paid = collectedFor(s.id);
    const due = Math.max(0, billed - paid);
    const pct = billed > 0 ? Math.round((paid / billed) * 100) : 100;
    return { ...s, paidFee: paid, billed, due, pct };
  });

  // top defaulters — full list (for the Pending Fees modal) and the
  // top-5 slice already shown inline, both derived from withProgress so
  // there's exactly one "who owes what" calculation on this page.
  const pendingStudents = withProgress.filter((s) => s.due > 0).sort((a, b) => b.due - a.due);
  const defaulters = pendingStudents.slice(0, 5);

  const recent = payments.slice(0, 6);

  // Pending reminders — installments due within the next N days or already overdue.
  const REMINDER_WINDOW_DAYS = 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + REMINDER_WINDOW_DAYS);
  const reminders = students
    .flatMap((s) => {
      const batch = batches.find((b) => b.id === s.batchId);
      return (s.installments ?? [])
        .filter((i) => !i.paid && i.dueDate)
        .map((i) => {
          const due = new Date(i.dueDate);
          const daysDiff = Math.round((due.getTime() - today.getTime()) / 86400000);
          return { student: s, batch, installment: i, daysDiff };
        })
        .filter((r) => r.installment && new Date(r.installment.dueDate) <= cutoff);
    })
    .sort((a, b) => a.daysDiff - b.daysDiff)
    .slice(0, 6);

  const sendReminder = (studentId: string, dueDate: string, amount: number) => {
    const st = students.find((x) => x.id === studentId);
    if (!st) return;
    const batch = batches.find((b) => b.id === st.batchId);
    const mobile = pickMobile(st);
    if (!mobile) {
      toast.error("No contact number on file for this student.");
      return;
    }
    const { templates, defaults } = getMessaging();
    const tpl = templates.find((t) => t.id === defaults.reminder) ?? templates[0];
    if (!tpl) {
      toast.error("No reminder template configured.");
      return;
    }
    const msg = renderMessage(
      tpl,
      buildContext({ student: st, batch, pending: amount, dueDate }),
    );
    openWhatsApp(mobile, msg);
  };


  // batch revenue
  const batchRevenue = batches.map((b) => {
    const sIds = students.filter((s) => s.batchId === b.id);
    const collected = sIds.reduce((a, s) => a + collectedFor(s.id), 0);
    return { name: b.name.split("—")[0].trim().slice(0, 18), value: collected };
  });

  // students by standard (exam-category students grouped under their exam
  // instead, since they don't have a standard) — for the Total Students
  // modal, sorted highest count first.
  const byStandard = new Map<string, number>();
  for (const s of students) {
    const label = s.standard ?? s.examCategory ?? "Other";
    byStandard.set(label, (byStandard.get(label) ?? 0) + 1);
  }
  const studentsByStandard = Array.from(byStandard, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count,
  );

  // Students below the follow-up threshold, reusing the same % collected
  // computed once in withProgress above.
  const followUpBelow = followUpThreshold;
  const followUpStudents = withProgress
    .filter((s) => s.pct <= followUpBelow)
    .sort((a, b) => a.pct - b.pct);

  return (
    <>
      <AppHeader
        title={`Welcome back, ${institute.name}`}
        subtitle={typeof window === "undefined" ? "Today's overview" : new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <Badge variant="secondary" className="ml-auto gap-1.5">
            <Sparkles className="h-3 w-3" /> Trial · 14 days left
          </Badge>
        }
      />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Quick actions */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AddStudentDialog
            trigger={
              <button className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserPlus className="h-5 w-5" /></span>
                <span>
                  <p className="font-display font-bold">Add Student</p>
                  <p className="text-xs text-muted-foreground">New admission</p>
                </span>
              </button>
            }
          />
          <Link to="/fees" className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success"><IndianRupee className="h-5 w-5" /></span>
            <span>
              <p className="font-display font-bold">Collect Fee</p>
              <p className="text-xs text-muted-foreground">Record payment</p>
            </span>
          </Link>
          <Link to="/receipts" className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info"><ReceiptIcon className="h-5 w-5" /></span>
            <span>
              <p className="font-display font-bold">Receipts</p>
              <p className="text-xs text-muted-foreground">Print &amp; share</p>
            </span>
          </Link>
          <Link to="/batches" className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground"><FileBarChart className="h-5 w-5" /></span>
            <span>
              <p className="font-display font-bold">Batches</p>
              <p className="text-xs text-muted-foreground">Manage batches</p>
            </span>
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Kpi
            label="Total students"
            value={students.length.toString()}
            delta={`${activeStudents} active`}
            tone="info"
            icon={<Users className="h-4 w-4" />}
            onClick={() => setStudentsModalOpen(true)}
          />
          <Kpi
            label="Collection efficiency"
            value={`${collectionRate}%`}
            delta={`${100 - collectionRate}% pending`}
            tone="primary"
            icon={<Percent className="h-4 w-4" />}
          />
          <Kpi label="Active batches" value={activeBatches.toString()} delta={`${batches.length} total`} tone="warning" icon={<BookOpen className="h-4 w-4" />} />
          <Kpi
            label="Total collection"
            value={inr(totalCollected)}
            delta={`${collectionRate}% of billed`}
            tone="success"
            icon={<IndianRupee className="h-4 w-4" />}
            onClick={() => setCollectionModalOpen(true)}
          />
          <Kpi
            label="Pending fees"
            value={inr(pending)}
            delta={`${pendingStudents.length} students`}
            tone="warning"
            icon={<AlertCircle className="h-4 w-4" />}
            onClick={() => setPendingModalOpen(true)}
          />
          <Kpi label="Monthly revenue" value={inr(monthlyRevenue)} delta="current month" tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Revenue chart */}
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Collection trend</CardTitle>
                <p className="text-xs text-muted-foreground">Last 8 months</p>
              </div>
              {hasTrendData && (
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3 text-success" /> Trending up
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {hasTrendData ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={months} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrShort} />
                      <Tooltip
                        contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number) => inr(v)}
                      />
                      <Area type="monotone" dataKey="collected" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#g1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <TrendingUp className="h-8 w-8 opacity-40" />
                  <p>No payments recorded in the last 8 months yet.</p>
                  <p className="text-xs">
                    The trend will appear here once collections start coming in.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Students needing follow-up */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Needs follow-up</CardTitle>
                <Select
                  value={String(followUpThreshold)}
                  onValueChange={(v) => setFollowUpThreshold(Number(v))}
                >
                  <SelectTrigger className="h-7 w-[84px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 30, 40, 50, 60].map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        ≤ {t}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Students who've collected {followUpThreshold}% or less
              </p>
            </CardHeader>
            <CardContent
              className="cursor-pointer"
              onClick={() => followUpStudents.length > 0 && setFollowUpModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-3xl font-bold leading-none">
                    {followUpStudents.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {followUpStudents.length === 1 ? "student" : "students"} below threshold
                  </p>
                </div>
              </div>
              {followUpStudents.length > 0 && (
                <p className="mt-3 text-xs text-primary hover:underline">
                  View list <ArrowUpRight className="inline h-3 w-3" />
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending reminders — installments due soon or overdue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-warning-foreground" />
                Pending reminders
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Installments overdue or due in the next {REMINDER_WINDOW_DAYS} days
              </p>
            </div>
            <Badge variant="outline">{reminders.length}</Badge>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No installments due in the next {REMINDER_WINDOW_DAYS} days. All caught up.
              </p>
            ) : (
              <div className="space-y-2">
                {reminders.map(({ student, batch, installment, daysDiff }) => {
                  const overdue = daysDiff < 0;
                  const dueLabel = overdue
                    ? `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? "" : "s"}`
                    : daysDiff === 0
                      ? "Due today"
                      : `Due in ${daysDiff} day${daysDiff === 1 ? "" : "s"}`;
                  return (
                    <div
                      key={`${student.id}-${installment.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/40 p-3"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-warning/20 text-warning-foreground text-xs font-bold">
                          {initials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/students/$id"
                            params={{ id: student.id }}
                            className="truncate font-medium hover:underline"
                          >
                            {student.name}
                          </Link>
                          <Badge
                            variant={overdue ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {dueLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {batch?.name ?? student.course ?? "—"} ·{" "}
                          {inr(installment.amount)} · Due {fmtDate(installment.dueDate)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendReminder(student.id, installment.dueDate, installment.amount)}
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Defaulters */}
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Top pending dues</CardTitle>
                <p className="text-xs text-muted-foreground">AI-suggested follow-ups</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/fees">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {defaulters.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card/40 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                      {initials(s.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link to="/students/$id" params={{ id: s.id }} className="truncate font-medium hover:underline">
                        {s.name}
                      </Link>
                      <span className="font-display font-bold text-destructive">{inr(s.due)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{s.course} · {s.rollNo}</span>
                      <span>{s.pct}% paid</span>
                    </div>
                    <Progress value={s.pct} className="mt-1.5 h-1.5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent payments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent payments</CardTitle>
                <p className="text-xs text-muted-foreground">Latest 6 transactions</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/receipts">All <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.map((p) => {
                const st = students.find((s) => s.id === p.studentId);
                return (
                  <Link
                    key={p.id}
                    to="/receipts/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{st?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.receiptNo} · {fmtDate(p.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-sm font-bold text-success">+{inr(p.amount)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.mode}</p>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Batch revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by batch</CardTitle>
            <p className="text-xs text-muted-foreground">Collected fees per active batch</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchRevenue} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrShort} />
                  <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={studentsModalOpen} onOpenChange={setStudentsModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Students by standard</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {studentsByStandard.map(({ label, count }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
              >
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">
                  {count} {count === 1 ? "Student" : "Students"}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={collectionModalOpen} onOpenChange={setCollectionModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Collected fees by batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {batchRevenue.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
              >
                <span className="font-medium">{b.name}</span>
                <span className="text-muted-foreground">{inr(b.value)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingModalOpen} onOpenChange={setPendingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Students with pending fees ({pendingStudents.length})</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {pendingStudents.map((s) => (
              <Link
                key={s.id}
                to="/students/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                <span className="ml-2 shrink-0 font-semibold text-destructive">{inr(s.due)}</span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={followUpModalOpen} onOpenChange={setFollowUpModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Needs follow-up — collected ≤ {followUpThreshold}% ({followUpStudents.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {followUpStudents.map((s) => (
              <Link
                key={s.id}
                to="/students/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">{s.pct}% paid</span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Kpi({
  label,
  value,
  delta,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "success" | "warning" | "info" | "primary";
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card
      onClick={onClick}
      className={
        onClick ? "cursor-pointer transition hover:border-primary hover:shadow-md" : undefined
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
        </div>
        <p className="mt-3 font-display text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{delta}</p>
      </CardContent>
    </Card>
  );
}
