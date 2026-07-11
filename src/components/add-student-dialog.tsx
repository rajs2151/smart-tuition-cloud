import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { createStudent, listBatches } from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";

const batchesQ = {
  queryKey: ["all-batches"],
  queryFn: () => listBatches(),
};

export function AddStudentDialog({ trigger }: { trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const { data: batches } = useSuspenseQuery(batchesQ);
  const [open, setOpen] = useState(false);

  const [tab, setTab] = useState<"personal" | "academic" | "fees">("personal");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    parentName: "",
    parentPhone: "",
    email: "",
    address: "",
    batchId: "",
    standard: "",
    board: "",
    medium: "",
    examCategory: "",
    courseFee: 0,
    admissionFee: 0,
    discount: 0,
    installments: 1,
  });
  const [courseFeeOverride, setCourseFeeOverride] = useState(false);

  const onB = (id: string) => {
    const b = batches.find((x) => x.id === id);
    setCourseFeeOverride(false);
    setForm((f) => ({
      ...f,
      batchId: id,
      standard: b?.standard ?? f.standard,
      board: b?.board ?? f.board,
      medium: b?.medium ?? f.medium,
      examCategory: b?.examCategory ?? f.examCategory,
      courseFee: b?.totalCourseFee ?? 0,
    }));
  };

  const submit = async () => {
    if (!form.name || !form.phone) return toast.error("Student name and phone are required");
    if (!form.batchId) return toast.error("Select a batch");
    const total = Number(form.courseFee) + Number(form.admissionFee);
    await createStudent({
      rollNo: `${settings.institute.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      name: form.name,
      phone: form.phone,
      parentName: form.parentName,
      parentPhone: form.parentPhone,
      email: form.email,
      address: form.address,
      batchId: form.batchId,
      standard: (form.standard || undefined) as never,
      board: form.board || undefined,
      medium: form.medium || undefined,
      examCategory: form.examCategory || undefined,
      courseFee: Number(form.courseFee),
      admissionFee: Number(form.admissionFee),
      discount: Number(form.discount),
      totalFee: total,
      paidFee: 0,
      admissionDate: new Date().toISOString().slice(0, 10),
      status: "active",
      course: batches.find((b) => b.id === form.batchId)?.course,
    });
    toast.success("Student admitted");
    await qc.invalidateQueries();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="h-4 w-4" /> Add student</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New student admission</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Student name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <FormField label="Mobile number *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <FormField label="Parent name" value={form.parentName} onChange={(v) => setForm({ ...form, parentName: v })} />
              <FormField label="Parent mobile" value={form.parentPhone} onChange={(v) => setForm({ ...form, parentPhone: v })} />
              <div className="col-span-2">
                <FormField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="academic" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label>Batch *</Label>
              <Select value={form.batchId} onValueChange={onB}>
                <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PickField label="Standard" value={form.standard} options={settings.master.standards}
                onChange={(v) => setForm({ ...form, standard: v })} />
              <PickField label="Board" value={form.board} options={settings.master.boards}
                onChange={(v) => setForm({ ...form, board: v })} />
              <PickField label="Medium" value={form.medium} options={settings.master.mediums}
                onChange={(v) => setForm({ ...form, medium: v })} />
            </div>
            <PickField label="Competitive exam (optional)" value={form.examCategory}
              options={["", ...settings.master.examCategories]}
              onChange={(v) => setForm({ ...form, examCategory: v })} />
          </TabsContent>

          <TabsContent value="fees" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Course fee (₹)</Label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      checked={courseFeeOverride}
                      onCheckedChange={setCourseFeeOverride}
                      className="scale-75"
                    />
                    Override
                  </label>
                </div>
                <Input
                  type="number"
                  value={form.courseFee}
                  disabled={!courseFeeOverride}
                  onChange={(e) => setForm({ ...form, courseFee: Number(e.target.value) })}
                />
                {!courseFeeOverride && (
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from the selected batch's total course fee. Turn on Override to change it for this student.
                  </p>
                )}
              </div>
              <NumField label="Admission fee (₹)" value={form.admissionFee} onChange={(v) => setForm({ ...form, admissionFee: v })} />
              <NumField label="Discount (₹)" value={form.discount} onChange={(v) => setForm({ ...form, discount: v })} />
              <NumField label="Installments" value={form.installments} onChange={(v) => setForm({ ...form, installments: v })} />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Total payable</span>
                <span className="font-display font-bold">
                  ₹{(Number(form.courseFee) + Number(form.admissionFee) - Number(form.discount)).toLocaleString("en-IN")}
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Admit student</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function PickField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.filter(Boolean).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
