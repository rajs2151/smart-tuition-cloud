import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle,
  XCircle, Loader2, X,
} from "lucide-react";

import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { createStudent, listStudents } from "@/lib/data/adapter";
import { useSettings } from "@/lib/settings/store";
import type { Batch } from "@/lib/data/types";

// ---------- Types ----------

type RawRow = Record<string, unknown>;

type ParsedRow = {
  rowNumber: number;             // 1-based sheet row (excluding header)
  name: string;
  phone: string;
  parentName?: string;
  parentPhone?: string;
  rollNo?: string;
  email?: string;
  address?: string;
  dob?: string;
  errors: string[];
  duplicate: boolean;
  duplicateReason?: string;
  raw: RawRow;
};

type ImportResult = {
  row: ParsedRow;
  status: "success" | "failed";
  error?: string;
};

// ---------- Column mapping ----------

const COLUMNS: Array<{ key: keyof Omit<ParsedRow, "rowNumber" | "errors" | "duplicate" | "duplicateReason" | "raw">; label: string; required?: boolean; aliases: string[] }> = [
  { key: "name", label: "Student Name", required: true, aliases: ["student name", "name", "student"] },
  { key: "phone", label: "Mobile Number", required: true, aliases: ["mobile number", "mobile", "phone", "student mobile", "student phone", "contact"] },
  { key: "parentName", label: "Parent Name", aliases: ["parent name", "guardian", "father name", "guardian name"] },
  { key: "parentPhone", label: "Parent Mobile", aliases: ["parent mobile", "parent phone", "guardian mobile", "father mobile"] },
  { key: "rollNo", label: "Roll Number", aliases: ["roll number", "roll no", "roll", "rollno"] },
  { key: "email", label: "Email", aliases: ["email", "email id", "e-mail"] },
  { key: "address", label: "Address", aliases: ["address"] },
  { key: "dob", label: "Date of Birth", aliases: ["date of birth", "dob", "birth date", "birthdate"] },
];

const TEMPLATE_HEADERS = COLUMNS.map((c) => c.label);
const TEMPLATE_SAMPLE: string[][] = [
  ["Aarav Sharma", "9876543210", "Rakesh Sharma", "9876500001", "R-001", "aarav@example.com", "Pune, MH", "2010-04-12"],
  ["Isha Patil", "9123456789", "Suresh Patil", "9123400002", "R-002", "isha@example.com", "Nashik, MH", "2011-08-03"],
];

function normalizeHeader(h: string): string {
  return String(h ?? "").trim().toLowerCase().replace(/[\s_]+/g, " ");
}

function normalizePhone(v: unknown): string {
  const s = String(v ?? "").replace(/\D+/g, "");
  return s;
}

function isValidPhone(p: string): boolean {
  return /^[6-9]\d{9}$/.test(p) || (p.length >= 10 && p.length <= 15);
}

// ---------- Parsing ----------

async function readWorkbook(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false });
}

function mapRow(raw: RawRow, rowNumber: number): ParsedRow {
  const lookup: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) lookup[normalizeHeader(k)] = v;

  const pick = (aliases: string[]): string => {
    for (const a of aliases) {
      const v = lookup[a];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const row: ParsedRow = {
    rowNumber,
    name: pick(COLUMNS[0].aliases),
    phone: normalizePhone(pick(COLUMNS[1].aliases)),
    parentName: pick(COLUMNS[2].aliases) || undefined,
    parentPhone: normalizePhone(pick(COLUMNS[3].aliases)) || undefined,
    rollNo: pick(COLUMNS[4].aliases) || undefined,
    email: pick(COLUMNS[5].aliases) || undefined,
    address: pick(COLUMNS[6].aliases) || undefined,
    dob: pick(COLUMNS[7].aliases) || undefined,
    errors: [],
    duplicate: false,
    raw,
  };
  return row;
}

function validateRow(r: ParsedRow) {
  if (!r.name) r.errors.push("Missing Student Name");
  if (!r.phone) r.errors.push("Missing Mobile Number");
  else if (!isValidPhone(r.phone)) r.errors.push("Invalid mobile number");
  if (r.parentPhone && !isValidPhone(r.parentPhone)) r.errors.push("Invalid parent mobile");
  if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) r.errors.push("Invalid email");
}

// ---------- Component ----------

type Stage = "upload" | "preview" | "importing" | "done";

export function ImportStudentsDialog({
  batch, open, onOpenChange,
}: {
  batch: Batch;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const settings = useSettings();

  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState<ImportResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef(false);

  const reset = () => {
    setStage("upload");
    setRows([]);
    setFileName("");
    setProgress(0);
    setImported([]);
    cancelRef.current = false;
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // ---------- Template download ----------

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `students-import-template.xlsx`);
  };

  // ---------- File handling ----------

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const raw = await readWorkbook(file);
      if (!raw.length) {
        toast.error("File is empty");
        return;
      }
      const parsed = raw.map((r, i) => mapRow(r, i + 2)); // +2 for header row and 1-based
      parsed.forEach(validateRow);

      // Duplicate detection: check against existing DB students + within file.
      const existing = await listStudents();
      const phones = new Set(existing.map((s) => normalizePhone(s.phone)).filter(Boolean));
      const parentPhones = new Set(existing.map((s) => normalizePhone(s.parentPhone ?? "")).filter(Boolean));

      const seenPhones = new Set<string>();
      const seenParent = new Set<string>();

      for (const r of parsed) {
        if (r.phone && phones.has(r.phone)) {
          r.duplicate = true;
          r.duplicateReason = "Mobile already exists";
        } else if (r.phone && seenPhones.has(r.phone)) {
          r.duplicate = true;
          r.duplicateReason = "Duplicate mobile in file";
        } else if (r.parentPhone && parentPhones.has(r.parentPhone)) {
          r.duplicate = true;
          r.duplicateReason = "Parent mobile already exists";
        } else if (r.parentPhone && seenParent.has(r.parentPhone)) {
          r.duplicate = true;
          r.duplicateReason = "Duplicate parent mobile in file";
        }
        if (r.phone) seenPhones.add(r.phone);
        if (r.parentPhone) seenParent.add(r.parentPhone);
      }

      setRows(parsed);
      setStage("preview");
    } catch (err) {
      console.error(err);
      toast.error("Could not read file. Ensure it is a valid .xlsx or .csv");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ---------- Stats ----------

  const stats = useMemo(() => {
    const total = rows.length;
    const duplicate = rows.filter((r) => r.duplicate && r.errors.length === 0).length;
    const invalid = rows.filter((r) => r.errors.length > 0).length;
    const valid = rows.filter((r) => r.errors.length === 0 && !r.duplicate).length;
    const missing = rows.filter((r) => r.errors.some((e) => e.startsWith("Missing"))).length;
    const phoneErr = rows.filter((r) => r.errors.some((e) => e.toLowerCase().includes("mobile"))).length;
    return { total, valid, duplicate, invalid, missing, phoneErr };
  }, [rows]);

  // ---------- Import ----------

  const runImport = async () => {
    const toImport = rows.filter((r) => r.errors.length === 0 && !r.duplicate);
    if (!toImport.length) {
      toast.error("No valid rows to import");
      return;
    }
    setStage("importing");
    setProgress(0);
    cancelRef.current = false;
    const results: ImportResult[] = [];

    const chunkSize = 10;
    for (let i = 0; i < toImport.length; i += chunkSize) {
      if (cancelRef.current) break;
      const chunk = toImport.slice(i, i + chunkSize);
      // sequential inside chunk to avoid rate-limits; await allows UI to breathe
      // between chunks (yield to event loop via setTimeout)
      for (const r of chunk) {
        try {
          const courseFee = (batch.monthlyFee ?? 0) * 12;
          await createStudent({
            rollNo: r.rollNo || `${settings.institute.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
            name: r.name,
            phone: r.phone,
            parentName: r.parentName,
            parentPhone: r.parentPhone,
            email: r.email,
            address: r.address,
            batchId: batch.id,
            standard: batch.standard,
            board: batch.board,
            medium: batch.medium,
            examCategory: batch.examCategory,
            courseFee,
            admissionFee: 0,
            discount: 0,
            totalFee: courseFee,
            paidFee: 0,
            admissionDate: new Date().toISOString().slice(0, 10),
            status: "active",
            course: batch.course,
          });
          results.push({ row: r, status: "success" });
        } catch (err) {
          results.push({
            row: r,
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
        setProgress(Math.round(((results.length) / toImport.length) * 100));
      }
      // Yield to keep UI responsive
      await new Promise((r) => setTimeout(r, 0));
    }

    setImported(results);
    setStage("done");
    await qc.invalidateQueries();
    const ok = results.filter((r) => r.status === "success").length;
    toast.success(`Imported ${ok} students`);
  };

  const downloadFailedCSV = () => {
    const failed = [
      ...imported.filter((r) => r.status === "failed").map((r) => ({ ...r.row, reason: r.error ?? "Import failed" })),
      ...rows.filter((r) => r.errors.length > 0).map((r) => ({ ...r, reason: r.errors.join("; ") })),
      ...rows.filter((r) => r.duplicate && r.errors.length === 0).map((r) => ({ ...r, reason: r.duplicateReason ?? "Duplicate" })),
    ];
    if (!failed.length) return;
    const rowsAoa = [
      [...TEMPLATE_HEADERS, "Reason"],
      ...failed.map((f) => [f.name, f.phone, f.parentName ?? "", f.parentPhone ?? "", f.rollNo ?? "", f.email ?? "", f.address ?? "", f.dob ?? "", f.reason]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Failed");
    XLSX.writeFile(wb, `failed-imports-${Date.now()}.csv`, { bookType: "csv" });
  };

  // ---------- Render ----------

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import students · {batch.name}</DialogTitle>
        </DialogHeader>

        {stage === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Drop your Excel or CSV file here</p>
              <p className="text-xs text-muted-foreground">or click to browse (.xlsx, .csv)</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Button className="mt-4" variant="secondary" onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose file
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                <p className="font-medium">Need the format?</p>
                <p className="text-xs text-muted-foreground">
                  Only student details. Batch, standard, board & fees come from “{batch.name}”.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Sample template
              </Button>
            </div>
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate text-muted-foreground">📄 {fileName}</span>
              <Button variant="ghost" size="sm" onClick={reset}><X className="h-3.5 w-3.5" /> Change file</Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Valid" value={stats.valid} tone="success" />
              <StatCard label="Duplicate" value={stats.duplicate} tone="warn" />
              <StatCard label="Invalid" value={stats.invalid} tone="danger" />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Missing fields: {stats.missing}</Badge>
              <Badge variant="outline">Phone errors: {stats.phoneErr}</Badge>
            </div>

            <ScrollArea className="h-72 rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="font-medium">{r.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{r.parentName ?? "—"}</TableCell>
                      <TableCell>
                        {r.errors.length > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{r.errors.join(", ")}</Badge>
                        ) : r.duplicate ? (
                          <Badge className="bg-warning/15 text-warning text-[10px]" variant="secondary">{r.duplicateReason}</Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success text-[10px]" variant="secondary">Valid</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={runImport} disabled={stats.valid === 0}>
                Import {stats.valid} student{stats.valid === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "importing" && (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm">Importing students… {progress}%</p>
            </div>
            <Progress value={progress} />
            <Button variant="outline" size="sm" onClick={() => { cancelRef.current = true; }}>
              Stop
            </Button>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <p className="mt-2 font-display text-lg font-bold">Import complete</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Imported" value={imported.filter((r) => r.status === "success").length} tone="success" />
              <StatCard label="Duplicates" value={stats.duplicate} tone="warn" />
              <StatCard
                label="Failed"
                value={imported.filter((r) => r.status === "failed").length + stats.invalid}
                tone="danger"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={downloadFailedCSV}
                disabled={imported.filter((r) => r.status === "failed").length + stats.invalid + stats.duplicate === 0}
              >
                <Download className="h-4 w-4" /> Download failed records
              </Button>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warn" | "danger" }) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "warn" ? "text-warning" :
    tone === "danger" ? "text-destructive" : "";
  const icon =
    tone === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
    tone === "warn" ? <AlertTriangle className="h-3.5 w-3.5" /> :
    tone === "danger" ? <XCircle className="h-3.5 w-3.5" /> : null;
  return (
    <div className="rounded-lg border p-3">
      <div className={`flex items-center gap-1 text-xs text-muted-foreground ${cls}`}>{icon}{label}</div>
      <p className={`font-display text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}
