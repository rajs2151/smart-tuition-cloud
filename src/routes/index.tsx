import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  BookOpen,
  Bell,
  MessageCircle,
  Receipt as ReceiptIcon,
  UserPlus,
  Sparkles,
  FileBarChart,
} from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AddStudentDialog } from "@/components/add-student-dialog";

import { listBatches, listPayments, listStudents } from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";
import { fmtDate, initials, inr, inrShort } from "@/lib/format";

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

  const totalBilled = students.reduce((a, s) => a + (s.totalFee - s.discount), 0);
  const totalCollected = students.reduce((a, s) => a + s.paidFee, 0);
  const pending = Math.max(0, totalBilled - totalCollected);
  const collectionRate = totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const activeStudents = students.filter((s) => s.status === "active").length;
  const activeBatches = batches.filter((b) => b.active !== false).length;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = payments
    .filter((p) => p.date.startsWith(thisMonth))
    .reduce((a, p) => a + p.amount, 0);
  const newAdmissions = students.filter((s) => s.admissionDate.startsWith(thisMonth)).length;

  // monthly trend (last 8 months)
  const months: { m: string; collected: number; due: number }[] = [];
  const now = new Date("2025-11-01");
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const collected = payments
      .filter((p) => p.date.startsWith(key))
      .reduce((a, p) => a + p.amount, 0);
    months.push({
      m: d.toLocaleString("en-IN", { month: "short" }),
      collected,
      due: Math.round(collected * (0.2 + Math.random() * 0.4)),
    });
  }

  // payment mode split
  const modeMap = new Map<string, number>();
  payments.forEach((p) => modeMap.set(p.mode, (modeMap.get(p.mode) || 0) + p.amount));
  const modeData = Array.from(modeMap, ([name, value]) => ({ name, value }));
  const modeColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  // top defaulters
  const defaulters = [...students]
    .map((s) => ({ ...s, due: Math.max(0, s.totalFee - s.discount - s.paidFee) }))
    .filter((s) => s.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 5);

  const recent = payments.slice(0, 6);

  // batch revenue
  const batchRevenue = batches.map((b) => {
    const sIds = students.filter((s) => s.batchId === b.id);
    const collected = sIds.reduce((a, s) => a + s.paidFee, 0);
    return { name: b.name.split("—")[0].trim().slice(0, 18), value: collected };
  });

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
          <Kpi label="Total students" value={students.length.toString()} delta={`${activeStudents} active`} tone="info" icon={<Users className="h-4 w-4" />} />
          <Kpi label="New admissions (this month)" value={newAdmissions.toString()} delta="+ this month" tone="primary" icon={<UserPlus className="h-4 w-4" />} />
          <Kpi label="Active batches" value={activeBatches.toString()} delta={`${batches.length} total`} tone="warning" icon={<BookOpen className="h-4 w-4" />} />
          <Kpi label="Total collection" value={inr(totalCollected)} delta={`${collectionRate}% of billed`} tone="success" icon={<IndianRupee className="h-4 w-4" />} />
          <Kpi label="Pending fees" value={inr(pending)} delta={`${defaulters.length} students`} tone="warning" icon={<AlertCircle className="h-4 w-4" />} />
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
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3 text-success" /> Trending up
              </Badge>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Payment mode */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment modes</CardTitle>
              <p className="text-xs text-muted-foreground">All-time share</p>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={modeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {modeData.map((_, i) => <Cell key={i} fill={modeColors[i % modeColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {modeData.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: modeColors[i % modeColors.length] }} />
                    <span className="text-muted-foreground">{m.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <span>{Math.round((s.paidFee / Math.max(1, s.totalFee - s.discount)) * 100)}% paid</span>
                    </div>
                    <Progress value={(s.paidFee / Math.max(1, s.totalFee - s.discount)) * 100} className="mt-1.5 h-1.5" />
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
    </>
  );
}

function Kpi({
  label,
  value,
  delta,
  tone,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "success" | "warning" | "info" | "primary";
  icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card>
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
