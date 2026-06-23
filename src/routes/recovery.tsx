import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  MessageCircle,
  Phone,
  Send,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import { listBatches, listPayments, listStudents } from "@/lib/data/adapter";
import { initials, inr, inrShort, fmtDate } from "@/lib/format";
import {
  buildContext, openWhatsApp, pickMobile, renderMessage, waLink,
} from "@/lib/messaging/whatsapp";
import {
  logComm, markLogPaid, useMessaging,
} from "@/lib/messaging/store";
import { CATEGORY_LABELS, type TemplateCategory } from "@/lib/messaging/templates";
import { useSettings } from "@/lib/settings/store";
import type { Batch, Student } from "@/lib/data/types";

const q = {
  queryKey: ["recovery-page"],
  queryFn: async () => ({
    students: await listStudents(),
    payments: await listPayments(),
    batches: await listBatches(),
  }),
};

export const Route = createFileRoute("/recovery")({
  head: () => ({
    meta: [
      { title: "Fee Recovery & WhatsApp — Vidyafee" },
      { name: "description", content: "Recover pending fees faster with priority-based WhatsApp reminders." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: RecoveryPage,
});

type Priority = "high" | "medium" | "low";
type Row = Student & {
  billed: number;
  pending: number;
  pct: number; // 0..1 pending share
  daysSince: number;
  priority: Priority;
  batch?: Batch;
  mobile: string;
};

function RecoveryPage() {
  const { data } = useSuspenseQuery(q);
  const messaging = useMessaging();
  const { institute } = useSettings();

  const rows: Row[] = useMemo(() => {
    const today = Date.now();
    return data.students
      .map((s) => {
        const billed = Math.max(0, s.totalFee - s.discount);
        const pending = Math.max(0, billed - s.paidFee);
        const pct = billed > 0 ? pending / billed : 0;
        const lastPay = data.payments
          .filter((p) => p.studentId === s.id)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const daysSince = lastPay
          ? Math.floor((today - new Date(lastPay.date).getTime()) / 86400000)
          : 9999;
        const priority: Priority = pct > 0.5 ? "high" : pct >= 0.25 ? "medium" : "low";
        const batch = data.batches.find((b) => b.id === s.batchId);
        return { ...s, billed, pending, pct, daysSince, priority, batch, mobile: pickMobile(s) };
      })
      .filter((r) => r.pending > 0);
  }, [data]);

  // Filters
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [batchId, setBatchId] = useState<string>("all");
  const [sort, setSort] = useState<"pending" | "pct" | "days" | "batch">("pct");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let xs = rows;
    if (priority !== "all") xs = xs.filter((r) => r.priority === priority);
    if (batchId !== "all") xs = xs.filter((r) => r.batchId === batchId);
    if (search.trim()) {
      const t = search.toLowerCase();
      xs = xs.filter((r) => r.name.toLowerCase().includes(t) || r.rollNo.toLowerCase().includes(t));
    }
    return [...xs].sort((a, b) => {
      if (sort === "pending") return b.pending - a.pending;
      if (sort === "pct") return b.pct - a.pct;
      if (sort === "days") return b.daysSince - a.daysSince;
      return (a.batch?.name ?? "").localeCompare(b.batch?.name ?? "");
    });
  }, [rows, priority, batchId, sort, search]);

  const totals = useMemo(() => {
    const pending = rows.reduce((a, r) => a + r.pending, 0);
    const high = rows.filter((r) => r.priority === "high").length;
    const monthStart = new Date(); monthStart.setDate(1);
    const collectedMonth = data.payments
      .filter((p) => new Date(p.date) >= monthStart)
      .reduce((a, p) => a + p.amount, 0);
    const recoveryPct = pending > 0 ? (collectedMonth / (collectedMonth + pending)) * 100 : 100;
    return { pending, students: rows.length, high, collectedMonth, recoveryPct };
  }, [rows, data.payments]);

  // Top pending batches
  const byBatch = useMemo(() => {
    const map = new Map<string, { name: string; pending: number; count: number }>();
    rows.forEach((r) => {
      const k = r.batch?.id ?? "—";
      const cur = map.get(k) ?? { name: r.batch?.name ?? "—", pending: 0, count: 0 };
      cur.pending += r.pending; cur.count += 1;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.pending - a.pending).slice(0, 5);
  }, [rows]);

  const topDefaulters = useMemo(
    () => [...rows].sort((a, b) => b.pending - a.pending).slice(0, 5),
    [rows],
  );

  // Reminders after-payment-tracking: count logs where paymentReceivedAfter
  const collectionsAfterReminder = useMemo(() => {
    const ids = new Set(
      messaging.logs.filter((l) => l.paymentReceivedAfter).map((l) => l.studentId),
    );
    return data.payments
      .filter((p) => ids.has(p.studentId))
      .reduce((a, p) => a + p.amount, 0);
  }, [messaging.logs, data.payments]);

  return (
    <>
      <AppHeader
        title="Fee Recovery & Communication"
        subtitle="Prioritise pending fees and send WhatsApp reminders in one click."
        actions={<BulkReminderDialog rows={rows} />}
      />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={AlertTriangle} tone="danger" label="Total pending" value={inrShort(totals.pending)} sub={`${totals.students} students`} />
          <Stat icon={Users} tone="warning" label="High priority" value={String(totals.high)} sub=">50% pending" />
          <Stat icon={CheckCircle2} tone="success" label="Collected this month" value={inrShort(totals.collectedMonth)} sub={`${totals.recoveryPct.toFixed(0)}% recovery`} />
          <Stat icon={Send} tone="info" label="Collected after reminders" value={inrShort(collectionsAfterReminder)} sub={`${messaging.logs.length} messages sent`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Priority recovery list</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-40"
                  />
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="h-8 w-32"><Filter className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priority</SelectItem>
                      <SelectItem value="high">High (&gt;50%)</SelectItem>
                      <SelectItem value="medium">Medium (25–50%)</SelectItem>
                      <SelectItem value="low">Low (&lt;25%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={batchId} onValueChange={setBatchId}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All batches</SelectItem>
                      {data.batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pct">Highest pending %</SelectItem>
                      <SelectItem value="pending">Highest pending amount</SelectItem>
                      <SelectItem value="days">Oldest unpaid</SelectItem>
                      <SelectItem value="batch">Batch-wise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="list">
                <TabsList className="mx-4 mb-2">
                  <TabsTrigger value="list">Students ({filtered.length})</TabsTrigger>
                  <TabsTrigger value="history">History ({messaging.logs.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="m-0">
                  <div className="divide-y border-t">
                    {filtered.map((r) => (
                      <RecoveryRow key={r.id} row={r} />
                    ))}
                    {filtered.length === 0 && (
                      <div className="p-10 text-center text-sm text-muted-foreground">
                        No pending fees match your filters. 🎉
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="history" className="m-0">
                  <div className="divide-y border-t">
                    {messaging.logs.map((l) => (
                      <div key={l.id} className="flex items-start gap-3 p-4">
                        <div className={`mt-1 h-2 w-2 rounded-full ${l.paymentReceivedAfter ? "bg-success" : "bg-warning"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{l.studentName}</p>
                            <Badge variant="outline">{CATEGORY_LABELS[l.category]}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{l.templateName}</Badge>
                            {l.paymentReceivedAfter && <Badge className="bg-success text-success-foreground text-[10px]">Payment received</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(l.date).toLocaleString("en-IN")} · {l.mobile} · by {l.sentBy}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.message}</p>
                        </div>
                      </div>
                    ))}
                    {messaging.logs.length === 0 && (
                      <div className="p-10 text-center text-sm text-muted-foreground">
                        No reminders sent yet.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top pending batches</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {byBatch.map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.count} students</p>
                    </div>
                    <span className="font-display font-bold text-destructive">{inrShort(b.pending)}</span>
                  </div>
                ))}
                {byBatch.length === 0 && <p className="text-xs text-muted-foreground">No dues.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top defaulters</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topDefaulters.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(r.name)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{(r.pct * 100).toFixed(0)}% pending</p>
                      </div>
                    </div>
                    <span className="font-display font-bold text-destructive">{inrShort(r.pending)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-info/30 bg-info/5">
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-semibold uppercase text-info">Future ready</p>
                <p className="text-xs text-muted-foreground">
                  Today reminders open WhatsApp via wa.me click-to-chat. The same module
                  is plug-ready for WhatsApp Business API, Twilio or Meta Cloud API —
                  swap the send function in <code>src/lib/messaging/whatsapp.ts</code>.
                </p>
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              Messages are generated from templates editable in <strong>Settings → Message Templates</strong>.
              Sent on behalf of <strong>{institute.name}</strong>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function priorityBadge(p: Priority) {
  if (p === "high") return <Badge className="bg-destructive text-destructive-foreground">High</Badge>;
  if (p === "medium") return <Badge className="bg-warning text-warning-foreground">Medium</Badge>;
  return <Badge className="bg-success text-success-foreground">Low</Badge>;
}

function RecoveryRow({ row }: { row: Row }) {
  const { templates, defaults } = useMessaging();
  const tpl =
    templates.find((t) => t.id === defaults.reminder) ??
    templates.find((t) => t.category === "reminder");

  const send = () => {
    if (!row.mobile) { toast.error("No mobile number on file"); return; }
    if (!tpl) { toast.error("Configure a default reminder template in Settings"); return; }
    const msg = renderMessage(tpl, buildContext({ student: row, batch: row.batch, pending: row.pending }));
    openWhatsApp(row.mobile, msg);
    logComm({
      studentId: row.id, studentName: row.name, mobile: row.mobile,
      templateId: tpl.id, templateName: tpl.name, category: "reminder",
      message: msg, sentBy: "owner",
    });
    toast.success("WhatsApp opened · reminder logged");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar className="h-10 w-10"><AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">{initials(row.name)}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{row.name}</p>
          {priorityBadge(row.priority)}
        </div>
        <p className="text-xs text-muted-foreground">
          {row.batch?.name ?? row.course} · Parent: {row.parentName ?? "—"} · <span className="font-medium">{row.parentPhone ?? row.phone}</span>
        </p>
      </div>
      <div className="hidden sm:block text-right">
        <p className="text-[11px] text-muted-foreground">Pending</p>
        <p className="font-display font-bold text-destructive">{inr(row.pending)}</p>
        <p className="text-[11px] text-muted-foreground">{(row.pct * 100).toFixed(0)}% · {row.daysSince > 365 ? "Never paid" : `${row.daysSince}d ago`}</p>
      </div>
      <div className="flex gap-1.5">
        <CustomMessageDialog row={row} />
        <Button size="sm" onClick={send} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
        {row.mobile && (
          <Button size="icon" variant="outline" asChild title="Call">
            <a href={`tel:${row.mobile}`}><Phone className="h-4 w-4" /></a>
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomMessageDialog({ row }: { row: Row }) {
  const { templates, defaults } = useMessaging();
  const remTpls = templates.filter((t) => t.category === "reminder");
  const [open, setOpen] = useState(false);
  const [tplId, setTplId] = useState(defaults.reminder);
  const tpl = templates.find((t) => t.id === tplId) ?? remTpls[0];
  const [msg, setMsg] = useState("");

  const reset = () => {
    if (!tpl) return;
    setMsg(renderMessage(tpl, buildContext({ student: row, batch: row.batch, pending: row.pending })));
  };

  const onOpen = (v: boolean) => {
    setOpen(v);
    if (v) reset();
  };

  const send = () => {
    if (!row.mobile) return toast.error("No mobile on file");
    openWhatsApp(row.mobile, msg);
    logComm({
      studentId: row.id, studentName: row.name, mobile: row.mobile,
      templateId: tpl?.id ?? "custom", templateName: tpl?.name ?? "Custom",
      category: "reminder", message: msg, sentBy: "owner",
    });
    toast.success("WhatsApp opened");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Customise</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Send reminder · {row.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={tplId} onValueChange={(v) => { setTplId(v); const t = templates.find((x) => x.id === v); if (t) setMsg(renderMessage(t, buildContext({ student: row, batch: row.batch, pending: row.pending }))); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {remTpls.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.language}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea rows={10} value={msg} onChange={(e) => setMsg(e.target.value)} className="font-mono text-xs" />
          <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            Will be sent to <strong>{row.parentPhone ?? row.phone}</strong> via WhatsApp.
            On payment, this reminder will be tagged as successful.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={reset}>Reset</Button>
          <Button onClick={send} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <Send className="h-4 w-4" /> Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkReminderDialog({ rows }: { rows: Row[] }) {
  const { templates, defaults } = useMessaging();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"all" | "high" | "due7" | "overdue" | "batch">("high");
  const [batchId, setBatchId] = useState<string>("");
  const [tplId, setTplId] = useState(defaults.reminder);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const audienceRows = useMemo(() => {
    let xs = rows;
    if (audience === "high") xs = xs.filter((r) => r.priority === "high");
    if (audience === "overdue") xs = xs.filter((r) => r.daysSince > 30);
    if (audience === "due7") xs = xs.filter((r) => r.daysSince > 0 && r.daysSince <= 7);
    if (audience === "batch") xs = xs.filter((r) => r.batchId === batchId);
    return xs;
  }, [rows, audience, batchId]);

  // sync selection when audience changes
  const allIds = audienceRows.map((r) => r.id).join(",");
  useMemo(() => { setSelected(new Set(audienceRows.map((r) => r.id))); /* eslint-disable-next-line */ }, [allIds]);

  const tpl = templates.find((t) => t.id === tplId);
  const totalPending = audienceRows
    .filter((r) => selected.has(r.id))
    .reduce((a, r) => a + r.pending, 0);

  const preview = tpl && audienceRows[0]
    ? renderMessage(tpl, buildContext({ student: audienceRows[0], batch: audienceRows[0].batch, pending: audienceRows[0].pending }))
    : "";

  const sendAll = () => {
    if (!tpl) return toast.error("Pick a template");
    const targets = audienceRows.filter((r) => selected.has(r.id) && r.mobile);
    if (targets.length === 0) return toast.error("No recipients with a mobile number");
    targets.forEach((r, i) => {
      const m = renderMessage(tpl, buildContext({ student: r, batch: r.batch, pending: r.pending }));
      // stagger window.open to avoid pop-up blocker (only first one will actually open in most browsers)
      setTimeout(() => openWhatsApp(r.mobile, m), i * 250);
      logComm({
        studentId: r.id, studentName: r.name, mobile: r.mobile,
        templateId: tpl.id, templateName: tpl.name, category: "reminder",
        message: m, sentBy: "owner (bulk)",
      });
    });
    toast.success(`${targets.length} reminders queued — confirm each WhatsApp tab.`);
    setOpen(false);
  };

  const batches = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.batch && m.set(r.batch.id, r.batch.name));
    return [...m.entries()];
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Send className="h-4 w-4" /> Bulk reminder</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Bulk WhatsApp reminder</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students with pending fees</SelectItem>
                  <SelectItem value="high">High priority (&gt;50% pending)</SelectItem>
                  <SelectItem value="due7">Last paid within 7 days</SelectItem>
                  <SelectItem value="overdue">Overdue (&gt;30 days)</SelectItem>
                  <SelectItem value="batch">Specific batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audience === "batch" && (
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="Pick batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={tplId} onValueChange={setTplId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.filter((t) => t.category === "reminder").map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} · {t.language}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Selected</span>
                <span className="font-display font-bold">{selected.size} / {audienceRows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total pending</span>
                <span className="font-display font-bold text-destructive">{inr(totalPending)}</span>
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto rounded-lg border">
              {audienceRows.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 border-b px-2 py-1.5 text-xs last:border-0">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={(v) => {
                      const s = new Set(selected);
                      if (v) s.add(r.id); else s.delete(r.id);
                      setSelected(s);
                    }}
                  />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-destructive">{inrShort(r.pending)}</span>
                </label>
              ))}
              {audienceRows.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">No matching students.</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">WhatsApp preview (first recipient)</Label>
            <div className="rounded-xl bg-[#e5ddd5] p-3 min-h-[260px]">
              <div className="ml-auto max-w-[88%] rounded-lg bg-[#dcf8c6] p-3 shadow-sm">
                <pre className="whitespace-pre-wrap break-words font-sans text-xs">{preview || "Pick a template…"}</pre>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <Clock className="inline h-3 w-3" /> Browsers may block multiple tabs at once — the agent stages them 250ms apart.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={sendAll} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <Send className="h-4 w-4" /> Send {selected.size} reminders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string;
  tone: "danger" | "warning" | "success" | "info";
}) {
  const toneCls = {
    danger: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    success: "text-success bg-success/10",
    info: "text-info bg-info/10",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-xl font-bold">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// Re-export for use elsewhere
export { markLogPaid, waLink, fmtDate };
