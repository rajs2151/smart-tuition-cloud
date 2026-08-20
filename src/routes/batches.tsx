import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Plus, BookOpen, GraduationCap, Pencil, Trash2, FileDown, Upload } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { RouteErrorComponent } from "@/components/route-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  createBatch, deleteBatch, listPaymentsForBatchInRange, updateBatch,
} from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";
import { inr, fmtDate, todayLocalISO } from "@/lib/format";
import { sanitizeNumberInput } from "@/lib/number-input";
import type { Batch, BatchType, Standard, Board, Medium, ExamCategory, Payment, Student } from "@/lib/data/types";
import { downloadBatchFeeReport } from "@/lib/reports/batch-fee-report";
import { downloadBatchCollectionReport } from "@/lib/reports/batch-collection-report";
import { batchesListQuery, paymentsListQuery, studentsListQuery, useBatchesList, usePaymentsList, useStudentsList } from "@/lib/query/lists";
import { invalidateAfterBatch } from "@/lib/query/invalidate";
import { FEE_LIMITS, clampFee, isValidPersonName, sanitizePersonName } from "@/lib/validation/input-rules";

const ImportStudentsDialog = lazy(() =>
  import("@/components/import-students-dialog").then((m) => ({ default: m.ImportStudentsDialog })),
);

export const Route = createFileRoute("/batches")({
  head: () => ({ meta: [{ title: "Batches — Vidyafee" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({ ...studentsListQuery, revalidateIfStale: true }),
      context.queryClient.ensureQueryData({ ...paymentsListQuery, revalidateIfStale: true }),
      context.queryClient.ensureQueryData({ ...batchesListQuery, revalidateIfStale: true }),
    ]),
  component: BatchesPage,
  errorComponent: RouteErrorComponent,
});

function BatchesPage() {
  const studentsQ = useStudentsList();
  const paymentsQ = usePaymentsList();
  const batchesQ = useBatchesList();
  const students = studentsQ.data ?? [];
  const payments = paymentsQ.data ?? [];
  const batches = batchesQ.data ?? [];
  const [tab, setTab] = useState<"all" | "standard" | "exam">("all");

  const filtered = batches.filter((b) =>
    tab === "all" ? true : tab === "standard" ? b.type === "standard" : b.type === "exam",
  );

  const countStudents = (batchId: string) =>
    students.filter((s) => s.batchId === batchId).length;

  return (
    <>
      <AppHeader
        title="Batches"
        subtitle={`${batches.length} batches · ${batches.filter((b) => b.active).length} active`}
        actions={<BatchDialog />}
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="standard">School / Standard</TabsTrigger>
            <TabsTrigger value="exam">Competitive Exam</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((b) => (
                <Card key={b.id} className="overflow-hidden">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${b.type === "exam" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                          {b.type === "exam" ? <GraduationCap className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                        </span>
                        <div>
                          <p className="font-display font-bold leading-tight">{b.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.type === "exam"
                              ? `${b.examCategory} ${b.examYear ?? ""}`
                              : `${b.standard} · ${b.board} · ${b.medium}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={b.active ? "secondary" : "outline"} className={b.active ? "bg-success/15 text-success" : ""}>
                        {b.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">Students</p>
                        <p className="font-display text-base font-bold">{countStudents(b.id)} / {b.capacity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total course fee</p>
                        <p className="font-display text-base font-bold">{inr(b.totalCourseFee)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Faculty</p>
                        <p className="truncate font-medium">{b.faculty ?? "—"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{b.startDate ? fmtDate(b.startDate) : "—"} → {b.endDate ? fmtDate(b.endDate) : "—"}</span>
                      <div className="flex gap-1">
                        <ImportButton batch={b} />
                        <BatchDialog batch={b} trigger={<Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Edit batch" title="Edit batch"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <DeleteBatchButton id={b.id} />
                      </div>
                    </div>

                    <DownloadCollectionReportButton batch={b} />
                    <DownloadFeeReportButton batch={b} students={students} payments={payments} />
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">No batches yet.</CardContent></Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function DeleteBatchButton({ id }: { id: string }) {
  const qc = useQueryClient();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={async () => {
        if (!confirm("Delete this batch?")) return;
        await deleteBatch(id);
        await invalidateAfterBatch(qc);
        toast.success("Batch deleted");
      }}
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );
}

function BatchDialog({ batch, trigger }: { batch?: Batch; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const isEdit = !!batch;

  const [form, setForm] = useState<Omit<Batch, "id" | "instituteId">>(
    batch
      ? { ...batch }
      : {
          name: "", type: "standard", standard: "10th", board: "State Board", medium: "English",
          faculty: "", totalCourseFee: 30000, capacity: 50, active: true,
          startDate: "", endDate: "",
        },
  );

  const [importFor, setImportFor] = useState<Batch | null>(null);

  const persist = async (): Promise<Batch | null> => {
    if (!form.name.trim()) { toast.error("Batch name is required"); return null; }
    if (form.faculty?.trim() && !isValidPersonName(form.faculty)) {
      toast.error("Faculty name should use letters only — no numbers or random symbols");
      return null;
    }
    if (form.type === "standard" && (!form.standard || !form.board || !form.medium)) {
      toast.error("Pick standard, board and medium"); return null;
    }
    if (form.type === "exam" && !form.examCategory) {
      toast.error("Pick an exam category"); return null;
    }
    const totalCourseFee = clampFee(form.totalCourseFee, FEE_LIMITS.batchCourseFee.min, FEE_LIMITS.batchCourseFee.max);
    const capacity = clampFee(form.capacity, FEE_LIMITS.batchCapacity.min, FEE_LIMITS.batchCapacity.max);
    if (totalCourseFee <= 0) {
      toast.error("Enter a realistic total course fee (₹1–₹5,00,000)");
      return null;
    }
    const payload = {
      ...form,
      name: form.name.trim().replace(/\s+/g, " "),
      faculty: form.faculty?.trim() ? sanitizePersonName(form.faculty).trim() : form.faculty,
      totalCourseFee,
      capacity,
    };
    if (isEdit && batch) {
      const updated = await updateBatch(batch.id, payload);
      toast.success("Batch updated");
      await invalidateAfterBatch(qc);
      return updated;
    }
    const created = await createBatch(payload);
    toast.success("Batch created");
    await invalidateAfterBatch(qc);
    return created;
  };

  const submit = async () => {
    const b = await persist();
    if (b) setOpen(false);
  };

  const submitAndImport = async () => {
    const b = await persist();
    if (!b) return;
    setOpen(false);
    setImportFor(b);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="h-4 w-4" /> New batch</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit batch" : "Create batch"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={form.type} onValueChange={(v) => setForm({ ...form, type: v as BatchType })}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="standard">School / Standard</TabsTrigger>
              <TabsTrigger value="exam">Competitive Exam</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label>Batch name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={form.type === "exam" ? "JEE 2027 Foundation" : "10th State Board Marathi - A"}
            />
          </div>

          {form.type === "standard" ? (
            <div className="grid grid-cols-3 gap-3">
              <PickField label="Standard" value={form.standard ?? ""} options={settings.master.standards}
                onChange={(v) => setForm({ ...form, standard: v as Standard })} />
              <PickField label="Board" value={form.board ?? ""} options={settings.master.boards}
                onChange={(v) => setForm({ ...form, board: v as Board })} />
              <PickField label="Medium" value={form.medium ?? ""} options={settings.master.mediums}
                onChange={(v) => setForm({ ...form, medium: v as Medium })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PickField label="Exam" value={form.examCategory ?? ""} options={settings.master.examCategories}
                onChange={(v) => setForm({ ...form, examCategory: v as ExamCategory })} />
              <div className="space-y-1.5">
                <Label>Target year</Label>
                <Input type="number" value={form.examYear ?? ""} onChange={(e) => setForm({ ...form, examYear: Number(e.target.value) })} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Faculty</Label>
              <Input
                value={form.faculty ?? ""}
                placeholder="e.g. Prof. Deshmukh"
                onChange={(e) => setForm({ ...form, faculty: sanitizePersonName(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={FEE_LIMITS.batchCapacity.min}
                max={FEE_LIMITS.batchCapacity.max}
                value={form.capacity}
                onChange={(e) => {
                  const cleaned = sanitizeNumberInput(e.target);
                  setForm({
                    ...form,
                    capacity: cleaned === ""
                      ? FEE_LIMITS.batchCapacity.min
                      : clampFee(Number(cleaned), FEE_LIMITS.batchCapacity.min, FEE_LIMITS.batchCapacity.max),
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total course fee (₹)</Label>
              <Input
                type="number"
                min={FEE_LIMITS.batchCourseFee.min}
                max={FEE_LIMITS.batchCourseFee.max}
                step={100}
                value={form.totalCourseFee}
                onChange={(e) => {
                  const cleaned = sanitizeNumberInput(e.target);
                  setForm({
                    ...form,
                    totalCourseFee: cleaned === ""
                      ? 0
                      : clampFee(Number(cleaned), FEE_LIMITS.batchCourseFee.min, FEE_LIMITS.batchCourseFee.max),
                  });
                }}
              />
              <p className="text-[11px] text-muted-foreground">Typical coaching fees: ₹5,000–₹1,50,000 (max ₹5,00,000).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.startDate ?? ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={form.endDate ?? ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3">
              <Label>Active</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="secondary" onClick={submitAndImport}>
            <Upload className="h-4 w-4" /> Import students
          </Button>
          <Button onClick={submit}>{isEdit ? "Update batch" : "Create batch"}</Button>
        </DialogFooter>
      </DialogContent>
      {importFor ? (
        <Suspense fallback={null}>
          <ImportStudentsDialog
            batch={importFor}
            open={!!importFor}
            onOpenChange={(v) => { if (!v) setImportFor(null); }}
          />
        </Suspense>
      ) : null}
    </Dialog>
  );
}

function DownloadCollectionReportButton({ batch }: { batch: Batch }) {
  const { institute } = useSettings();
  const today = todayLocalISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const rows = await listPaymentsForBatchInRange(batch.id, fromDate, toDate);
      await downloadBatchCollectionReport(batch, institute.name, fromDate, toDate, rows);
      toast.success("Collection report downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate the collection report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">From Date</Label>
          <Input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">To Date</Label>
          <Input
            type="date"
            value={toDate}
            min={fromDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading}
        onClick={handleDownload}
      >
        <FileDown className="h-3.5 w-3.5" />
        {loading ? "Generating…" : "Download Collection Report"}
      </Button>
    </div>
  );
}

function DownloadFeeReportButton({
  batch,
  students,
  payments,
}: {
  batch: Batch;
  students: Student[];
  payments: Payment[];
}) {
  const [loading, setLoading] = useState(false);
  const studentCount = students.filter((s) => s.batchId === batch.id).length;

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadBatchFeeReport(batch, students, payments);
      toast.success("Fee report downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate the fee report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={loading || studentCount === 0}
      onClick={handleDownload}
      title={studentCount === 0 ? "No students in this batch yet" : "Download Batch Fee Report"}
    >
      <FileDown className="h-3.5 w-3.5" />
      {loading ? "Generating…" : "Download Batch Fee Report"}
    </Button>
  );
}

function ImportButton({ batch }: { batch: Batch }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => setOpen(true)} title="Import students">
        <Upload className="h-3.5 w-3.5" />
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <ImportStudentsDialog batch={batch} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}

function PickField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
