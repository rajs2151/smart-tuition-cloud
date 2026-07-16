import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

import { listLogs, listRecycle, useAudit } from "@/lib/audit/store";
import { getActorName } from "@/lib/team/store";
import {
  listStudents, restoreStudent, purgeStudent,
  restoreBatch, purgeBatch,
  restorePayment, purgePayment,
} from "@/lib/data/adapter";
import {
  listDeletedExpenses, restoreExpense, purgeExpense, useExpenseStore,
} from "@/lib/expenses/store";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/recycle-bin")({
  head: () => ({
    meta: [
      { title: "Recycle Bin & Audit — Vidyafee" },
      { name: "description", content: "Restore mistakenly deleted records and review the activity audit log." },
    ],
  }),
  component: RecyclePage,
});

function RecyclePage() {
  const qc = useQueryClient();
  useAudit();
  useExpenseStore();
  // touch students list to ensure refresh on changes
  const [, setTick] = useState(0);
  useEffect(() => { listStudents(true); }, []);

  const refresh = () => setTick((n) => n + 1);

  const recycle = listRecycle();
  const deletedExpenses = listDeletedExpenses();
  const logs = listLogs();

  const [q, setQ] = useState("");
  const filteredRecycle = useMemo(() => recycle.filter((r) =>
    !q || r.label.toLowerCase().includes(q.toLowerCase()) || r.entity.includes(q.toLowerCase())
  ), [recycle, q]);

  const doRestore = async (entity: string, id: string) => {
    if (entity === "student") await restoreStudent(id);
    else if (entity === "batch") await restoreBatch(id);
    else if (entity === "payment") await restorePayment(id);
    toast.success("Restored");
    refresh();
    await qc.invalidateQueries({ refetchType: "all" });
  };
  const doPurge = async (entity: string, id: string) => {
    if (entity === "student") await purgeStudent(id);
    else if (entity === "batch") await purgeBatch(id);
    else if (entity === "payment") await purgePayment(id);
    toast.success("Permanently deleted");
    refresh();
    await qc.invalidateQueries({ refetchType: "all" });
  };

  return (
    <>
      <AppHeader title="Recycle Bin" subtitle="Restore deleted records and review the audit trail" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Tabs defaultValue="bin">
          <TabsList>
            <TabsTrigger value="bin">Recycle Bin</TabsTrigger>
            <TabsTrigger value="expenses">Deleted Expenses</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="bin" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <CardTitle className="text-base">Deleted records ({recycle.length})</CardTitle>
                <div className="relative ml-auto w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                {filteredRecycle.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Recycle bin is empty.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredRecycle.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">{r.label}</p>
                          <p className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="mr-2 capitalize">{r.entity}</Badge>
                            Deleted by {r.deletedBy} on {fmtDate(r.deletedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
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
                {deletedExpenses.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No deleted expenses.</p>
                ) : (
                  <div className="space-y-2">
                    {deletedExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">₹{e.amount.toLocaleString("en-IN")} · {e.vendor ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">Deleted on {e.deletedAt ? fmtDate(e.deletedAt) : "—"} by {e.deletedBy ?? "—"}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { restoreExpense(e.id); toast.success("Restored"); }}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                          </Button>
                          <PurgeButton onConfirm={() => { purgeExpense(e.id); toast.success("Permanently deleted"); }} />
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
                {logs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <div className="divide-y">
                    {logs.slice(0, 200).map((l) => (
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
        <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" /> Permanently delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete forever?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone. The record will be permanently removed.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete forever</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
