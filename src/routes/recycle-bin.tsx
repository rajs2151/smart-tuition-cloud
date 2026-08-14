import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2, Search, Clock } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { getActorName } from "@/lib/team/store";
import {
  listDeletedStudents, restoreStudent, purgeStudent,
  listDeletedBatches, restoreBatch, purgeBatch,
  listDeletedPayments, restorePayment, purgePayment,
  listDeletedExpenses, restoreExpense, purgeExpense,
  listAuditLogs,
} from "@/lib/data/adapter";
import { fmtDate } from "@/lib/format";
import { invalidateAfterBatch, invalidateAfterPayment, invalidateAfterStudent } from "@/lib/query/invalidate";

export const Route = createFileRoute("/recycle-bin")({
  head: () => ({
    meta: [
      { title: "Recycle Bin & Audit — Vidyafee" },
      { name: "description", content: "Restore mistakenly deleted records and review the activity audit log." },
    ],
  }),
  component: RecyclePage,
});

type RecycleRow = {
  entity: "student" | "batch" | "payment";
  entityId: string;
  label: string;
  deletedAt?: string;
  deletedBy?: string;
};

function RecyclePage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const studentsQ = useQuery({ queryKey: ["deleted-students"], queryFn: listDeletedStudents });
  const batchesQ = useQuery({ queryKey: ["deleted-batches"], queryFn: listDeletedBatches });
  const paymentsQ = useQuery({ queryKey: ["deleted-payments"], queryFn: listDeletedPayments });
  const deletedExpensesQuery = useQuery({ queryKey: ["deleted-expenses"], queryFn: listDeletedExpenses });
  const auditQ = useQuery({ queryKey: ["audit-logs"], queryFn: () => listAuditLogs(200) });

  const deletedExpenses = deletedExpensesQuery.data ?? [];
  const logs = auditQ.data ?? [];

  const recycle: RecycleRow[] = useMemo(() => {
    const students = (studentsQ.data ?? []).map((s) => ({
      entity: "student" as const,
      entityId: s.id,
      label: s.name,
      deletedAt: s.deletedAt,
      deletedBy: s.deletedBy,
    }));
    const batches = (batchesQ.data ?? []).map((b) => ({
      entity: "batch" as const,
      entityId: b.id,
      label: b.name,
      deletedAt: b.deletedAt,
      deletedBy: b.deletedBy,
    }));
    const payments = (paymentsQ.data ?? []).map((p) => ({
      entity: "payment" as const,
      entityId: p.id,
      label: `${p.receiptNo} · ₹${p.amount}`,
      deletedAt: p.deletedAt,
      deletedBy: p.deletedBy,
    }));
    return [...students, ...batches, ...payments].sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }, [studentsQ.data, batchesQ.data, paymentsQ.data]);

  const filteredRecycle = useMemo(() => recycle.filter((r) =>
    !q || r.label.toLowerCase().includes(q.toLowerCase()) || r.entity.includes(q.toLowerCase())
  ), [recycle, q]);

  const invalidateRecycle = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["deleted-students"] }),
      qc.invalidateQueries({ queryKey: ["deleted-batches"] }),
      qc.invalidateQueries({ queryKey: ["deleted-payments"] }),
      qc.invalidateQueries({ queryKey: ["audit-logs"] }),
      invalidateAfterStudent(qc),
      invalidateAfterBatch(qc),
      invalidateAfterPayment(qc),
    ]);
  };

  const doRestore = async (entity: string, id: string) => {
    try {
      if (entity === "student") await restoreStudent(id);
      else if (entity === "batch") await restoreBatch(id);
      else if (entity === "payment") await restorePayment(id);
      toast.success("Restored");
      await invalidateRecycle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore this record.");
    }
  };
  const doPurge = async (entity: string, id: string) => {
    try {
      if (entity === "student") await purgeStudent(id);
      else if (entity === "batch") await purgeBatch(id);
      else if (entity === "payment") await purgePayment(id);
      toast.success("Permanently deleted");
      await invalidateRecycle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not permanently delete this record.");
    }
  };

  const doRestoreExpense = async (id: string) => {
    try {
      await restoreExpense(id);
      toast.success("Restored");
      qc.invalidateQueries({ queryKey: ["deleted-expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-page"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore this expense.");
    }
  };
  const doPurgeExpense = async (id: string) => {
    try {
      await purgeExpense(id);
      toast.success("Permanently deleted");
      qc.invalidateQueries({ queryKey: ["deleted-expenses"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not permanently delete this expense.");
    }
  };

  const recycleLoading = studentsQ.isLoading || batchesQ.isLoading || paymentsQ.isLoading;

  return (
    <>
      <AppHeader title="Recycle Bin" subtitle="Restore deleted records and review the audit trail" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Tabs defaultValue="bin">
          <TabsList className="flex h-auto w-full flex-nowrap justify-start overflow-x-auto">
            <TabsTrigger value="bin" className="shrink-0">Recycle Bin</TabsTrigger>
            <TabsTrigger value="expenses" className="shrink-0">Deleted Expenses</TabsTrigger>
            <TabsTrigger value="audit" className="shrink-0">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="bin" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <CardTitle className="text-base">Deleted records ({filteredRecycle.length})</CardTitle>
                <div className="relative ml-auto w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                {recycleLoading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
                ) : filteredRecycle.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Recycle bin is empty.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredRecycle.map((r) => (
                      <div key={`${r.entity}:${r.entityId}`} className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{r.label}</p>
                          <p className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="mr-2 capitalize">{r.entity}</Badge>
                            Deleted by {r.deletedBy ? getActorName(r.deletedBy) : "—"} on {r.deletedAt ? fmtDate(r.deletedAt) : "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="outline" onClick={() => doRestore(r.entity, r.entityId)}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                          </Button>
                          <PurgeButton onConfirm={() => doPurge(r.entity, r.entityId)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Deleted expenses ({deletedExpenses.length})</CardTitle></CardHeader>
              <CardContent>
                {deletedExpensesQuery.isLoading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
                ) : deletedExpenses.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No deleted expenses.</p>
                ) : (
                  <div className="space-y-2">
                    {deletedExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">₹{e.amount.toLocaleString("en-IN")} · {e.vendor ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">Deleted on {e.deletedAt ? fmtDate(e.deletedAt) : "—"} by {e.deletedBy ? getActorName(e.deletedBy) : "—"}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="outline" onClick={() => doRestoreExpense(e.id)}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                          </Button>
                          <PurgeButton onConfirm={() => doPurgeExpense(e.id)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent activity ({logs.length})</CardTitle></CardHeader>
              <CardContent>
                {auditQ.isLoading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
                ) : logs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <div className="divide-y">
                    {logs.map((l) => (
                      <div key={l.id} className="flex items-start gap-3 py-2.5 text-sm">
                        <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p>
                            <Badge variant="outline" className="mr-2 capitalize">{l.entity}</Badge>
                            <span className="capitalize text-muted-foreground">{l.action}</span>
                            <span className="ml-2">{l.summary}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{getActorName(l.by)} · {new Date(l.at).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function PurgeButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete forever
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. The record will be removed from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete forever</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
