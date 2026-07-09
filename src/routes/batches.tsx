import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, BookOpen, GraduationCap, Pencil, Trash2 } from "lucide-react";

import { AppHeader } from "@/components/app-header";
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
  createBatch, deleteBatch, listBatches, listStudents, updateBatch,
} from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";
import { inr, fmtDate } from "@/lib/format";
import type { Batch, BatchType, Standard, Board, Medium, ExamCategory } from "@/lib/data/types";
import { ImportStudentsDialog } from "@/components/import-students-dialog";
import { Upload } from "lucide-react";

const q = {
  queryKey: ["batches-page"],
  queryFn: async () => ({
    batches: await listBatches(),
    students: await listStudents(),
  }),
};

export const Route = createFileRoute("/batches")({
  head: () => ({ meta: [{ title: "Batches — Vidyafee" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: BatchesPage,
});

function BatchesPage() {
  const { data } = useSuspenseQuery(q);
  const [tab, setTab] = useState<"all" | "standard" | "exam">("all");

  const filtered = data.batches.filter((b) =>
    tab === "all" ? true : tab === "standard" ? b.type === "standard" : b.type === "exam",
  );

  const countStudents = (batchId: string) =>
    data.students.filter((s) => s.batchId === batchId).length;

  return (
    <>
      <AppHeader
        title="Batches"
        subtitle={`${data.batches.length} batches · ${data.batches.filter((b) => b.active).length} active`}
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
                        <p className="text-muted-foreground">Monthly fee</p>
                        <p className="font-display text-base font-bold">{inr(b.monthlyFee)}</p>
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
                        <BatchDialog batch={b} trigger={<Button size="icon" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <DeleteBatchButton id={b.id} />
                      </div>
                    </div>
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
        await qc.invalidateQueries();
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
          faculty: "", monthlyFee: 3000, capacity: 50, active: true,
          startDate: "", endDate: "",
        },
  );

  const [importFor, setImportFor] = useState<Batch | null>(null);

  const persist = async (): Promise<Batch | null> => {
    if (!form.name) { toast.error("Batch name is required"); return null; }
    if (form.type === "standard" && (!form.standard || !form.board || !form.medium)) {
      toast.error("Pick standard, board and medium"); return null;
    }
    if (form.type === "exam" && !form.examCategory) {
      toast.error("Pick an exam category"); return null;
    }
    if (isEdit && batch) {
      const updated = await updateBatch(batch.id, form);
      toast.success("Batch updated");
      await qc.invalidateQueries();
      return updated;
    }
    const created = await createBatch(form);
    toast.success("Batch created");
    await qc.invalidateQueries();
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
              <Input value={form.faculty ?? ""} onChange={(e) => setForm({ ...form, faculty: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly fee (₹)</Label>
              <Input type="number" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: Number(e.target.value) })} />
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>{isEdit ? "Update batch" : "Create batch"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
