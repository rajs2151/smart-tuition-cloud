import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Plus, Search, Pencil, Trash2, Download, Printer, Wallet, TrendingUp, IndianRupee, Receipt,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  addExpenseCategory,
  createExpense,
  deleteExpenseCategory,
  getExpenseBreakdownByCategory,
  getProfitabilitySummary,
  listExpenseCategories,
  listExpenses,
  renameExpenseCategory,
  softDeleteExpense,
  toggleExpenseCategory,
  updateExpense,
} from "@/lib/data/adapter";
import type { Expense, ExpenseCategory, ExpensePaymentMode } from "@/lib/expenses/types";
import { fmtDate, inr, inrShort, todayLocalISO } from "@/lib/format";

// Matches the GENESIS_DATE convention already used in
// components/attendance/reports/batch-day-list.tsx for "show me
// everything, no range picker" browsing.
const GENESIS_DATE = "2000-01-01";

const pageQuery = {
  queryKey: ["expenses-page"],
  queryFn: async () => ({
    expenses: await listExpenses(),
    categories: await listExpenseCategories(),
  }),
};

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Vidyafee" },
      { name: "description", content: "Track operating expenses, monitor profitability and export financial reports." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery),
  component: ExpensesPage,
});

const MODES: ExpensePaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Cheque"];

function ExpensesPage() {
  const { data } = useSuspenseQuery(pageQuery);
  const { expenses, categories } = data;
  const [tab, setTab] = useState("dashboard");

  const today = todayLocalISO();
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);

  const totals = useMemo(() => {
    const t = expenses.reduce((a, e) => a + e.amount, 0);
    const td = expenses.filter((e) => e.date === today).reduce((a, e) => a + e.amount, 0);
    const tm = expenses.filter((e) => e.date.startsWith(thisMonth)).reduce((a, e) => a + e.amount, 0);
    const ty = expenses.filter((e) => e.date.startsWith(thisYear)).reduce((a, e) => a + e.amount, 0);
    return { total: t, today: td, month: tm, year: ty };
  }, [expenses, today, thisMonth, thisYear]);

  return (
    <>
      <AppHeader
        title="Expenses"
        subtitle="Operational spend, profitability and reports"
        actions={<ExpenseDialog categories={categories} />}
      />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Today" value={inr(totals.today)} icon={<Wallet className="h-4 w-4" />} tone="primary" />
          <Stat label="This Month" value={inr(totals.month)} icon={<TrendingUp className="h-4 w-4" />} tone="info" />
          <Stat label="This Year" value={inr(totals.year)} icon={<Receipt className="h-4 w-4" />} tone="warning" />
          <Stat label="All Time" value={inr(totals.total)} icon={<IndianRupee className="h-4 w-4" />} tone="success" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          {/* Five labels overflow a phone-width row; without horizontal
              scroll the page grows wider than the viewport and mobile
              browsers shrink ("zoom out") the whole Expenses screen. */}
          <TabsList className="flex h-auto w-full flex-nowrap justify-start overflow-x-auto">
            <TabsTrigger value="dashboard" className="shrink-0">Dashboard</TabsTrigger>
            <TabsTrigger value="list" className="shrink-0">All Expenses</TabsTrigger>
            <TabsTrigger value="profit" className="shrink-0">Profitability</TabsTrigger>
            <TabsTrigger value="categories" className="shrink-0">Categories</TabsTrigger>
            <TabsTrigger value="reports" className="shrink-0">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4"><DashboardTab expenses={expenses} /></TabsContent>
          <TabsContent value="list" className="mt-4"><ListTab expenses={expenses} categories={categories} /></TabsContent>
          <TabsContent value="profit" className="mt-4"><ProfitTab /></TabsContent>
          <TabsContent value="categories" className="mt-4"><CategoriesTab categories={categories} /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportsTab expenses={expenses} categories={categories} /></TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "info" | "warning" | "success" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/10 text-success",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
        </div>
        <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// ------------ Dashboard tab ------------
function DashboardTab({ expenses }: { expenses: Expense[] }) {
  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  // Previously computed client-side from the full `expenses` array already
  // in memory (correct, but doesn't scale — loads every expense row just to
  // sum them locally, and left the get_expense_breakdown_by_category RPC
  // unused). Now server-aggregated for the same all-time range this always
  // showed; the RPC already returns rows sorted by total_amount DESC.
  const breakdownQuery = useQuery({
    queryKey: ["expenses-category-breakdown"],
    queryFn: () => getExpenseBreakdownByCategory(GENESIS_DATE, todayLocalISO()),
  });
  const byCat = (breakdownQuery.data ?? []).map((r) => ({ name: r.categoryName, value: r.totalAmount }));

  const monthly = useMemo(() => {
    const months: { m: string; v: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const v = expenses.filter((e) => e.date.startsWith(k)).reduce((a, e) => a + e.amount, 0);
      months.push({ m: d.toLocaleString("en-IN", { month: "short" }), v });
    }
    return months;
  }, [expenses]);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader><CardTitle className="text-base">Monthly expense trend</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrShort} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">By category</CardTitle></CardHeader>
        <CardContent>
          {breakdownQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : byCat.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses yet</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                    {byCat.slice(0, 6).map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="xl:col-span-3">
        <CardHeader><CardTitle className="text-base">Top expense categories</CardTitle></CardHeader>
        <CardContent>
          {breakdownQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : byCat.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses yet</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCat.slice(0, 8)} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={inrShort} />
                  <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------ List tab ------------
function ListTab({ expenses, categories }: { expenses: Expense[]; categories: ExpenseCategory[] }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (catFilter !== "all" && e.categoryId !== catFilter) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (search) {
        const q = search.toLowerCase();
        const cat = categories.find((c) => c.id === e.categoryId)?.name ?? "";
        return cat.toLowerCase().includes(q) || (e.vendor ?? "").toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [expenses, search, catFilter, from, to, categories]);

  const total = filtered.reduce((a, e) => a + e.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:flex-1">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search vendor, description…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Badge variant="secondary" className="self-start md:self-end">Total: {inr(total)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No expenses found. Click <strong>Add Expense</strong> to record one.</p>
        ) : (
          <>
            {/* Card layout below md — the table below doesn't reflow, so
                give narrow screens a stacked-card view instead of a
                horizontally-scrolled 6-column table. */}
            <div className="space-y-2 md:hidden">
              {filtered.map((e) => {
                const cat = categories.find((c) => c.id === e.categoryId);
                return (
                  <div key={e.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{cat?.name ?? "—"}</p>
                        {e.subCategory && <p className="text-xs text-muted-foreground">{e.subCategory}</p>}
                        <p className="text-xs text-muted-foreground">{fmtDate(e.date)}</p>
                      </div>
                      <p className="shrink-0 font-display font-bold">{inr(e.amount)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{e.mode}</Badge>
                        {e.vendor && <span className="text-xs text-muted-foreground">{e.vendor}</span>}
                      </div>
                      <div className="flex gap-1">
                        <ExpenseDialog editing={e} categories={categories} trigger={<Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Edit expense" title="Edit expense"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <DeleteExpenseButton id={e.id} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Vendor</th>
                    <th className="p-2">Mode</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const cat = categories.find((c) => c.id === e.categoryId);
                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="p-2">{fmtDate(e.date)}</td>
                        <td className="p-2"><div className="font-medium">{cat?.name ?? "—"}</div>{e.subCategory && <div className="text-xs text-muted-foreground">{e.subCategory}</div>}</td>
                        <td className="p-2 text-muted-foreground">{e.vendor ?? "—"}</td>
                        <td className="p-2"><Badge variant="outline">{e.mode}</Badge></td>
                        <td className="p-2 text-right font-display font-bold">{inr(e.amount)}</td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-1">
                            <ExpenseDialog editing={e} categories={categories} trigger={<Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Edit expense" title="Edit expense"><Pencil className="h-3.5 w-3.5" /></Button>} />
                            <DeleteExpenseButton id={e.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteExpenseButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const handleDelete = async () => {
    try {
      await softDeleteExpense(id);
      toast.success("Moved to Recycle Bin");
      qc.invalidateQueries({ queryKey: ["expenses-page"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete this expense.");
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive" aria-label="Delete expense" title="Delete expense"><Trash2 className="h-3.5 w-3.5" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle>
          <AlertDialogDescription>You can restore this expense later from the Recycle Bin.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ------------ Add/Edit Expense Dialog ------------
function ExpenseDialog({ editing, categories, trigger }: { editing?: Expense; categories: ExpenseCategory[]; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const activeCategories = categories.filter((c) => c.active);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(editing?.date ?? todayLocalISO());
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? activeCategories[0]?.id ?? "");
  const [subCategory, setSubCategory] = useState(editing?.subCategory ?? "");
  const [amount, setAmount] = useState<number>(editing?.amount ?? 0);
  const [mode, setMode] = useState<ExpensePaymentMode>(editing?.mode ?? "Cash");
  const [vendor, setVendor] = useState(editing?.vendor ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [attachmentName, setAttachmentName] = useState(editing?.attachmentName ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!categoryId || !amount) { toast.error("Category and amount are required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateExpense(editing.id, { date, categoryId, subCategory, amount, mode, vendor, description, attachmentName });
        toast.success("Expense updated");
      } else {
        await createExpense({ date, categoryId, subCategory, amount, mode, vendor, description, attachmentName });
        toast.success("Expense added");
      }
      qc.invalidateQueries({ queryKey: ["expenses-page"] });
      qc.invalidateQueries({ queryKey: ["expenses-profitability"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-1.5 h-4 w-4" /> Add Expense</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Amount (₹)"><Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
          </div>
          <Field label="Category">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.group} · {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subcategory (optional)"><Input value={subCategory} onChange={(e) => setSubCategory(e.target.value)} /></Field>
            <Field label="Payment mode">
              <Select value={mode} onValueChange={(v) => setMode(v as ExpensePaymentMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Vendor (optional)"><Input value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
          <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Attachment (bill / invoice / receipt)">
            <Input type="file" onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")} />
            {attachmentName && <p className="mt-1 text-xs text-muted-foreground">Attached: {attachmentName}</p>}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Expense"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="grid gap-1.5"><Label className="text-xs">{label}</Label>{children}</div>);
}

// ------------ Profitability tab ------------
function ProfitTab() {
  const profitQuery = useQuery({
    queryKey: ["expenses-profitability"],
    queryFn: async () => {
      const today = todayLocalISO();
      const thisMonthStart = `${today.slice(0, 7)}-01`;
      const now = new Date();

      const monthRanges = Array.from({ length: 8 }, (_, idx) => {
        const i = 7 - idx;
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const end = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
        return { label: d.toLocaleString("en-IN", { month: "short" }), start, end };
      });

      // One RPC call per range — arbitrary _from/_to, not fixed daily/monthly
      // variants, per the confirmed design. All-time + this-month + one call
      // per trend month = 10 calls total.
      const [allTime, thisMonth, ...monthResults] = await Promise.all([
        getProfitabilitySummary(GENESIS_DATE, today),
        getProfitabilitySummary(thisMonthStart, today),
        ...monthRanges.map((r) => getProfitabilitySummary(r.start, r.end)),
      ]);

      return {
        allTime,
        thisMonth,
        monthly: monthRanges.map((r, i) => ({
          m: r.label,
          rev: monthResults[i].totalRevenue,
          exp: monthResults[i].totalExpenses,
          profit: monthResults[i].netProfit,
        })),
      };
    },
  });

  if (profitQuery.isLoading || !profitQuery.data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (profitQuery.isError) {
    return <p className="p-6 text-sm text-destructive">Could not load profitability data.</p>;
  }

  const { allTime, thisMonth, monthly } = profitQuery.data;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total Revenue" value={inr(allTime.totalRevenue)} icon={<IndianRupee className="h-4 w-4" />} tone="success" />
        <Stat label="Total Expenses" value={inr(allTime.totalExpenses)} icon={<Wallet className="h-4 w-4" />} tone="warning" />
        <Stat
          label={allTime.netProfit >= 0 ? "Net Profit" : "Net Loss"}
          value={inr(Math.abs(allTime.netProfit))}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={allTime.netProfit >= 0 ? "primary" : "warning"}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="This Month Revenue" value={inr(thisMonth.totalRevenue)} icon={<IndianRupee className="h-4 w-4" />} tone="success" />
        <Stat label="This Month Expenses" value={inr(thisMonth.totalExpenses)} icon={<Wallet className="h-4 w-4" />} tone="warning" />
        <Stat label="This Month Profit" value={inr(thisMonth.netProfit)} icon={<TrendingUp className="h-4 w-4" />} tone="info" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit trend (last 8 months)</CardTitle>
          <p className="text-xs text-muted-foreground">Net Profit = Total Revenue − Total Expenses (server-computed, revenue excludes voided payments)</p>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrShort} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="rev" name="Revenue" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="exp" name="Expenses" fill="var(--color-warning)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------ Categories tab ------------
function CategoriesTab({ categories }: { categories: ExpenseCategory[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Custom");

  const grouped = useMemo(() => {
    const map = new Map<string, typeof categories>();
    categories.forEach((c) => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return Array.from(map);
  }, [categories]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["expenses-page"] });

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggleExpenseCategory(id, active);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this category.");
    }
  };

  // The FK-violation-aware handler you asked to see verbatim: deleteExpenseCategory
  // (in adapter.ts) rethrows a plain, user-facing Error on Postgres 23503
  // (category still referenced by expenses) instead of a raw Postgres error.
  // This handler is async and awaits it, unlike the old synchronous
  // deleteCategory(c.id); toast.success(...) pattern, which could never fail
  // and would have shown a false "Category deleted" success toast on a real
  // FK-violation failure.
  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteExpenseCategory(id);
      toast.success("Category deleted");
      invalidate();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Could not delete this category.",
      );
    }
  };

  const handleAddCategory = async () => {
    if (!name.trim()) { toast.error("Enter a name"); return; }
    try {
      await addExpenseCategory(name, group || "Custom");
      setName("");
      toast.success("Category added");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add this category.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">All categories</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {grouped.map(([g, list]) => (
            <div key={g}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
              <div className="space-y-1.5">
                {list.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {c.custom && <span className="text-[10px] uppercase tracking-wide text-primary">Custom</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">{c.active ? "Active" : "Inactive"}</span>
                      <span className="-m-3 p-3">
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => handleToggle(c.id, v)}
                          aria-label={`${c.active ? "Deactivate" : "Activate"} category ${c.name}`}
                        />
                      </span>
                      <RenameCategoryButton id={c.id} current={c.name} />
                      {c.custom && (
                        <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive" aria-label="Delete category" title="Delete category" onClick={() => handleDeleteCategory(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add custom category</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Group">
            <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Custom" />
          </Field>
          <Field label="Category name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guest Faculty Charges" />
          </Field>
          <Button onClick={handleAddCategory} className="w-full">
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RenameCategoryButton({ id, current }: { id: string; current: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current);

  const save = async () => {
    try {
      await renameExpenseCategory(id, val);
      setOpen(false);
      toast.success("Renamed");
      qc.invalidateQueries({ queryKey: ["expenses-page"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename this category.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(current); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Rename category" title="Rename category"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Rename category</DialogTitle></DialogHeader>
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------ Reports tab ------------
function ReportsTab({ expenses, categories }: { expenses: Expense[]; categories: ExpenseCategory[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const filtered = useMemo(() => expenses.filter((e) => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (catFilter !== "all" && e.categoryId !== catFilter) return false;
    return true;
  }), [expenses, from, to, catFilter]);

  const total = filtered.reduce((a, e) => a + e.amount, 0);

  const exportCsv = () => {
    const header = ["Date", "Category", "Subcategory", "Vendor", "Mode", "Amount", "Description"];
    const rows = filtered.map((e) => [
      e.date,
      categories.find((c) => c.id === e.categoryId)?.name ?? "",
      e.subCategory ?? "",
      e.vendor ?? "",
      e.mode,
      e.amount,
      (e.description ?? "").replace(/[\r\n,]/g, " "),
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:flex-1">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Category">
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button variant="outline" className="flex-1" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
              <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
            </div>
          </div>
          <Badge variant="secondary">Total: {inr(total)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 md:hidden">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No records for selected filters</p>
          ) : (
            filtered.map((e) => (
              <div key={e.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{categories.find((c) => c.id === e.categoryId)?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(e.date)} · {e.mode}</p>
                  </div>
                  <p className="shrink-0 font-display font-bold">{inr(e.amount)}</p>
                </div>
                {e.vendor && <p className="mt-1 text-xs text-muted-foreground">{e.vendor}</p>}
              </div>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Vendor</th><th className="p-2">Mode</th><th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-2">{fmtDate(e.date)}</td>
                  <td className="p-2">{categories.find((c) => c.id === e.categoryId)?.name ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{e.vendor ?? "—"}</td>
                  <td className="p-2">{e.mode}</td>
                  <td className="p-2 text-right font-display font-bold">{inr(e.amount)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No records for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
