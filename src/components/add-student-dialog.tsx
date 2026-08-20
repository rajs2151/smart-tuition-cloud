import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
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

import { createStudent, updateStudent } from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";
import type { Student } from "@/lib/data/types";
import { batchesListQuery } from "@/lib/query/lists";
import { invalidateAfterStudent } from "@/lib/query/invalidate";
import {
  FEE_LIMITS,
  clampFee,
  isValidPersonName,
  parseFeeInput,
  sanitizePersonName,
} from "@/lib/validation/input-rules";

export function AddStudentDialog({ trigger, student, open: openProp, onOpenChange: onOpenChangeProp }: {
  trigger?: React.ReactNode;
  /** When provided, the dialog opens pre-filled for editing this student instead of admitting a new one. */
  student?: Student;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const settings = useSettings();
  const { data: batches = [] } = useQuery({ ...batchesListQuery, placeholderData: keepPreviousData });
  const isEdit = !!student;
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChangeProp ?? setOpenState;

  const [tab, setTab] = useState<"personal" | "academic" | "fees">("personal");
  const [form, setForm] = useState(() => student ? {
    name: student.name,
    phone: student.phone,
    parentName: student.parentName ?? "",
    parentPhone: student.parentPhone ?? "",
    email: student.email ?? "",
    address: student.address ?? "",
    dob: student.dob ?? "",
    rollNo: student.rollNo,
    batchId: student.batchId,
    standard: student.standard ?? "",
    board: student.board ?? "",
    medium: student.medium ?? "",
    examCategory: student.examCategory ?? "",
    courseFee: student.courseFee,
    admissionFee: student.admissionFee,
    discount: student.discount,
    installments: student.installments?.length || 1,
  } : {
    name: "",
    phone: "",
    parentName: "",
    parentPhone: "",
    email: "",
    address: "",
    dob: "",
    rollNo: "",
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
  // Editing an existing student's already-settled fee is a deliberate override
  // by default; a fresh admission auto-fills from the batch until the coach
  // explicitly opts in to overriding it.
  const [courseFeeOverride, setCourseFeeOverride] = useState(isEdit);

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
    if (!isValidPersonName(form.name)) {
      return toast.error("Enter a real student name (letters only, at least 2 characters)");
    }
    if (form.parentName.trim() && !isValidPersonName(form.parentName)) {
      return toast.error("Parent name should use letters only — no numbers or random symbols");
    }
    if (!form.phone) return toast.error("Student name and phone are required");
    if (!form.batchId) return toast.error("Select a batch");
    const courseFee = clampFee(Number(form.courseFee), FEE_LIMITS.courseFee.min, FEE_LIMITS.courseFee.max);
    const admissionFee = clampFee(Number(form.admissionFee), FEE_LIMITS.admissionFee.min, FEE_LIMITS.admissionFee.max);
    const discount = clampFee(Number(form.discount), FEE_LIMITS.discount.min, FEE_LIMITS.discount.max);
    if (discount > courseFee + admissionFee) {
      return toast.error("Discount cannot be more than the total fee");
    }
    if (courseFee + admissionFee <= 0) {
      return toast.error("Enter a realistic course or admission fee (₹1–₹5,00,000)");
    }
    const total = courseFee + admissionFee;
    const common = {
      rollNo: form.rollNo,
      name: form.name.trim().replace(/\s+/g, " "),
      phone: form.phone,
      parentName: form.parentName.trim().replace(/\s+/g, " "),
      parentPhone: form.parentPhone,
      email: form.email,
      address: form.address,
      dob: form.dob || undefined,
      batchId: form.batchId,
      standard: (form.standard || undefined) as never,
      board: form.board || undefined,
      medium: form.medium || undefined,
      examCategory: form.examCategory || undefined,
      courseFee,
      admissionFee,
      discount,
      totalFee: total,
    };
    if (isEdit) {
      await updateStudent(student.id, common);
      toast.success("Student updated");
    } else {
      await createStudent({
        ...common,
        rollNo: form.rollNo || `${settings.institute.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        paidFee: 0,
        admissionDate: new Date().toISOString().slice(0, 10),
        status: "active",
        course: batches.find((b) => b.id === form.batchId)?.course,
      });
      toast.success("Student admitted");
    }
    await invalidateAfterStudent(qc);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        trigger !== undefined ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : !isEdit ? (
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add student</Button>
          </DialogTrigger>
        ) : null
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${student.name}` : "New student admission"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Student name *"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: sanitizePersonName(v) })}
                placeholder="e.g. Aarav Sharma"
              />
              <FormField label="Mobile number *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile" />
              <FormField
                label="Parent name"
                value={form.parentName}
                onChange={(v) => setForm({ ...form, parentName: sanitizePersonName(v) })}
                placeholder="e.g. Mrs. Sharma"
              />
              <FormField label="Parent mobile" value={form.parentPhone} onChange={(v) => setForm({ ...form, parentPhone: v.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile" />
              <FormField label="Roll number" value={form.rollNo} onChange={(v) => setForm({ ...form, rollNo: v })} />
              <FormField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
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
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  {batches.find((b) => b.id === form.batchId)?.faculty
                    ? `Faculty: ${batches.find((b) => b.id === form.batchId)?.faculty}`
                    : "Changing the batch does not overwrite an already-customized course fee."}
                </p>
              )}
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
                  min={FEE_LIMITS.courseFee.min}
                  max={FEE_LIMITS.courseFee.max}
                  step={100}
                  value={form.courseFee}
                  disabled={!courseFeeOverride}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      courseFee: parseFeeInput(e.target.value, FEE_LIMITS.courseFee.min, FEE_LIMITS.courseFee.max),
                    })
                  }
                />
                {!courseFeeOverride && (
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from the selected batch's total course fee. Turn on Override to change it for this student.
                  </p>
                )}
              </div>
              <NumField
                label="Admission fee (₹)"
                value={form.admissionFee}
                min={FEE_LIMITS.admissionFee.min}
                max={FEE_LIMITS.admissionFee.max}
                onChange={(v) => setForm({ ...form, admissionFee: v })}
              />
              <NumField
                label="Discount (₹)"
                value={form.discount}
                min={FEE_LIMITS.discount.min}
                max={FEE_LIMITS.discount.max}
                onChange={(v) => setForm({ ...form, discount: v })}
              />
              <NumField
                label="Installments"
                value={form.installments}
                min={FEE_LIMITS.installmentCount.min}
                max={FEE_LIMITS.installmentCount.max}
                onChange={(v) => setForm({ ...form, installments: v })}
              />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Total payable</span>
                <span className="font-display font-bold">
                  ₹{(Number(form.courseFee) + Number(form.admissionFee) - Number(form.discount)).toLocaleString("en-IN")}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Course fee up to ₹5,00,000 · admission up to ₹1,00,000 · discount cannot exceed total fee.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>{isEdit ? "Save changes" : "Admit student"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 500_000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={label.includes("Installments") ? 1 : 100}
        value={value}
        onChange={(e) => onChange(parseFeeInput(e.target.value, min, max))}
      />
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
