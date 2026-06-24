import { createFileRoute } from "@tanstack/react-router";
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
  addCategory, createExpense, deleteCategory, listCategories, listExpenses,
  renameCategory, softDeleteExpense, toggleCategory, updateExpense, useExpenseStore,
} from "@/lib/expenses/store";
import type { Expense, ExpensePaymentMode } from "@/lib/expenses/types";
import { fmtDate, inr, inrShort } from "@/lib/format";
import { listPayments } from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Vidyafee" },
      { name: "description", content: "Track operating expenses, monitor profitability and export financial reports." },
    ],
  }),
  component: ExpensesPage,
});

const MODES: ExpensePaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Cheque"];

function ExpensesPage() {
  useExpenseStore(); // subscribe
  useSettings();
  const expenses = listExpenses();
  const categories = listCategories();
  const [tab, setTab] = useState("dashboard");

  const today = new Date().toISOString().slice(0, 10);
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
        actions={<ExpenseDialog />}
      />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Today" value={inr(totals.today)} icon={<Wallet className="h-4 w-4" />} tone="primary" />
          <Stat label="This Month" value={inr(totals.month)} icon={<TrendingUp className="h-4 w-4" />} tone="info" />
          <Stat label="This Year" value={inr(totals.year)} icon={<Receipt className="h-4 w-4" />} tone="warning" />
          <Stat label="All Time" value={inr(totals.total)} icon={<IndianRupee className="h-4 w-4" />} tone="success" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="list">All Expenses</TabsTrigger>
            <TabsTrigger value="profit">Profitability</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
          <TabsContent value="list" className="mt-4"><ListTab /></TabsContent>
          <TabsContent value="profit" className="mt-4"><ProfitTab /></TabsContent>
          <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
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
function DashboardTab() {
  const expenses = listExpenses();
  const categories = listCategories();
  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount));
    return Array.from(map, ([id, value]) => ({
      name: categories.find((c) => c.id === id)?.name ?? "—",
      value,
    })).sort((a, b) => b.value - a.value);
  }, [expenses, categories]);

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
          {byCat.length === 0 ? (
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
        </CardContent>
      </Card>
    </div>
  );
}

// ------------ List tab ------------
function ListTab() {
  const expenses = listExpenses();
  const categories = listCategories();
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
          <div className="overflow-x-auto">
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
                          <ExpenseDialog editing={e} trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>} />
                          <DeleteExpenseButton id={e.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteExpenseButton({ id }: { id: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle>
          <AlertDialogDescription>You can restore this expense later from the Recycle Bin.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { softDeleteExpense(id); toast.success("Moved to Recycle Bin"); }}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ------------ Add/Edit Expense Dialog ------------
function ExpenseDialog({ editing, trigger }: { editing?: Expense; trigger?: React.ReactNode }) {
  const categories = listCategories().filter((c) => c.active);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? categories[0]?.id ?? "");
  const [subCategory, setSubCategory] = useState(editing?.subCategory ?? "");
  const [amount, setAmount] = useState<number>(editing?.amount ?? 0);
  const [mode, setMode] = useState<ExpensePaymentMode>(editing?.mode ?? "Cash");
  const [vendor, setVendor] = useState(editing?.vendor ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [attachmentName, setAttachmentName] = useState(editing?.attachmentName ?? "");

  const submit = () => {
    if (!categoryId || !amount) { toast.error("Category and amount are required"); return; }
    if (editing) {
      updateExpense(editing.id, { date, categoryId, subCategory, amount, mode, vendor, description, attachmentName });
      toast.success("Expense updated");
    } else {
      createExpense({ date, categoryId, subCategory, amount, mode, vendor, description, attachmentName });
      toast.success("Expense added");
    }
    setOpen(false);
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
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.group} · {c.name}</SelectItem>)}
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
          <Button onClick={submit}>{editing ? "Save Changes" : "Add Expense"}</Button>
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
  const expenses = listExpenses();
  const [data, setData] = useState<{ revenue: number; monthly: { m: string; rev: number; exp: number; profit: number }[] } | null>(null);

  useEffect(() => {
    listPayments().then((payments) => {
      const revenue = payments.reduce((a, p) => a + p.amount, 0);
      const months: { m: string; rev: number; exp: number; profit: number }[] = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const rev = payments.filter((p) => p.date.startsWith(k)).reduce((a, p) => a + p.amount, 0);
        const exp = expenses.filter((e) => e.date.startsWith(k)).reduce((a, e) => a + e.amount, 0);
        months.push({ m: d.toLocaleString("en-IN", { month: "short" }), rev, exp, profit: rev - exp });
      }
      setData({ revenue, monthly: months });
    });
  }, [expenses]);

  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const totalExp = expenses.reduce((a, e) => a + e.amount, 0);
  const profit = data.revenue - totalExp;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRev = data.monthly[data.monthly.length - 1]?.rev ?? 0;
  const monthExp = data.monthly[data.monthly.length - 1]?.exp ?? 0;
  const monthProfit = monthRev - monthExp;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total Revenue" value={inr(data.revenue)} icon={<IndianRupee className="h-4 w-4" />} tone="success" />
        <Stat label="Total Expenses" value={inr(totalExp)} icon={<Wallet className="h-4 w-4" />} tone="warning" />
        <Stat label={profit >= 0 ? "Net Profit" : "Net Loss"} value={inr(Math.abs(profit))} icon={<TrendingUp className="h-4 w-4" />} tone={profit >= 0 ? "primary" : "warning"} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="This Month Revenue" value={inr(monthRev)} icon={<IndianRupee className="h-4 w-4" />} tone="success" />
        <Stat label="This Month Expenses" value={inr(monthExp)} icon={<Wallet className="h-4 w-4" />} tone="warning" />
        <Stat label="This Month Profit" value={inr(monthProfit)} icon={<TrendingUp className="h-4 w-4" />} tone="info" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit trend (last 8 months)</CardTitle>
          <p className="text-xs text-muted-foreground">Net Profit = Total Collection − Total Expenses</p>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
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
function CategoriesTab() {
  const categories = listCategories();
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
                  <div key={c.id} className="flex items-center justify-between rounded-md border p-2">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.custom && <span className="text-[10px] uppercase tracking-wide text-primary">Custom</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={c.active} onCheckedChange={(v) => toggleCategory(c.id, v)} />
                      <RenameCategoryButton id={c.id} current={c.name} />
                      {c.custom && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { deleteCategory(c.id); toast.success("Category deleted"); }}>
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
          <Button
            onClick={() => {
              if (!name.trim()) { toast.error("Enter a name"); return; }
              addCategory(name, group || "Custom");
              setName("");
              toast.success("Category added");
            }}
            className="w-full"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RenameCategoryButton({ id, current }: { id: string; current: string }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(current); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Rename category</DialogTitle></DialogHeader>
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { renameCategory(id, val); setOpen(false); toast.success("Renamed"); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------ Reports tab ------------
function ReportsTab() {
  const expenses = listExpenses();
  const categories = listCategories();
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
        <div className="overflow-x-auto">
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
