import type { Batch, Payment, Student } from "@/lib/data/types";
import { getSettings } from "@/lib/settings/store";
import { fmtDate } from "@/lib/format";
import type { MessageTemplate } from "./templates";

export type TemplateContext = Partial<Record<string, string | number>>;

/** Build a default context object from a student + optional batch/payment. */
export function buildContext(opts: {
  student?: Student;
  batch?: Batch;
  payment?: Payment;
  pending?: number;
  dueDate?: string;
  extras?: TemplateContext;
}): TemplateContext {
  const { institute } = getSettings();
  const { student, batch, payment, pending, dueDate, extras } = opts;
  const billed = student ? student.totalFee - student.discount : 0;
  const pendingAmt = pending ?? (student ? Math.max(0, billed - student.paidFee) : 0);
  return {
    InstituteName: institute.name,
    InstituteContact: institute.phone,
    StudentName: student?.name ?? "",
    ParentName: student?.parentName ?? "Parent",
    BatchName: batch?.name ?? student?.course ?? "",
    Standard: student?.standard ?? batch?.standard ?? "",
    Board: student?.board ?? batch?.board ?? "",
    Medium: student?.medium ?? batch?.medium ?? "",
    TotalFee: billed,
    PaidAmount: payment?.amount ?? student?.paidFee ?? 0,
    PendingAmount: pendingAmt,
    ReceiptNumber: payment?.receiptNo ?? "",
    PaymentDate: payment?.date ? fmtDate(payment.date) : fmtDate(new Date().toISOString()),
    DueDate: dueDate ? fmtDate(dueDate) : "",
    ...extras,
  };
}

const VAR_RE = /\{\{\s*([A-Za-z][A-Za-z0-9 _]*)\s*\}\}/g;

/** Render a template body, replacing {{Var}} (whitespace-insensitive) with values. */
export function renderTemplate(content: string, ctx: TemplateContext): string {
  return content.replace(VAR_RE, (_m, raw: string) => {
    const key = raw.replace(/\s+/g, "");
    const v = ctx[key] ?? ctx[raw];
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "number") return v.toLocaleString("en-IN");
    return String(v);
  });
}

export function renderMessage(template: MessageTemplate, ctx: TemplateContext): string {
  return renderTemplate(template.content, ctx);
}

/** Pick parent phone, fall back to student phone. Returns digits only with country code. */
export function pickMobile(student: Pick<Student, "parentPhone" | "phone">): string {
  const raw = (student.parentPhone || student.phone || "").replace(/\D/g, "");
  if (!raw) return "";
  if (raw.startsWith("91")) return raw;
  if (raw.length === 10) return `91${raw}`;
  return raw;
}

export function waLink(mobile: string, message: string): string {
  const m = mobile.replace(/\D/g, "");
  return `https://wa.me/${m}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(mobile: string, message: string) {
  if (typeof window === "undefined") return;
  window.open(waLink(mobile, message), "_blank", "noopener,noreferrer");
}
