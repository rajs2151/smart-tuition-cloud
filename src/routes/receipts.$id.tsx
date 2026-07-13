import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, MessageCircle, Printer } from "lucide-react";
import { useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { getStudent, listBatches, listPayments } from "@/lib/data/adapter";
import { fmtDate, inr } from "@/lib/format";
import { useSettings } from "@/lib/settings/store";
import { getEffectiveReceiptContact } from "@/lib/settings/receipt-contact";
import { exportElementToPdf } from "@/lib/pdf/export";
import { getMessaging } from "@/lib/messaging/store";
import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/receipts/$id")({
  loader: async ({ params, context }) => {
    return context.queryClient.ensureQueryData({
      queryKey: ["receipt", params.id],
      queryFn: async () => {
        const all = await listPayments();
        const payment = all.find((p) => p.id === params.id);
        if (!payment) throw notFound();
        const student = await getStudent(payment.studentId);
        const batches = await listBatches();
        return { payment, student, batch: batches.find((b) => b.id === student?.batchId) };
      },
    });
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Receipt ${loaderData?.payment?.receiptNo ?? ""} — Vidyafee` }],
  }),
  component: ReceiptDetail,
});

function ReceiptDetail() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery({
    queryKey: ["receipt", params.id],
    queryFn: async () => {
      const all = await listPayments();
      const payment = all.find((p) => p.id === params.id)!;
      const student = await getStudent(payment.studentId);
      const batches = await listBatches();
      return { payment, student, batch: batches.find((b) => b.id === student?.batchId) };
    },
  });
  const { institute, receipt: cfg } = useSettings();
  const { payment, student, batch } = data;
  if (!student) return null;

  const contact = getEffectiveReceiptContact(institute, cfg);
  const billed = student.totalFee - student.discount;
  const balance = Math.max(0, billed - student.paidFee);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const onDownload = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      await exportElementToPdf(receiptRef.current, `Receipt-${payment.receiptNo}.pdf`);
    } catch (e) {
      toast.error(`Could not generate PDF: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };

  const onWhatsApp = () => {
    const mobile = pickMobile(student);
    if (!mobile) {
      toast.error("No contact number on file for this student.");
      return;
    }
    const { templates, defaults } = getMessaging();
    const tpl = templates.find((t) => t.id === defaults.acknowledgement) ?? templates[0];
    if (!tpl) {
      toast.error("No message template configured.");
      return;
    }
    const msg = renderMessage(tpl, buildContext({ student, batch, payment }));
    openWhatsApp(mobile, msg);
  };

  return (
    <>
      <AppHeader
        title={`Receipt ${payment.receiptNo}`}
        subtitle={`Issued ${fmtDate(payment.date)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/receipts"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print A4</Button>
            <Button variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
              <Download className="h-4 w-4" /> {downloading ? "Generating…" : "Download PDF"}
            </Button>
            <Button variant="outline" size="sm" onClick={onWhatsApp}><MessageCircle className="h-4 w-4" /> Send WhatsApp</Button>
          </>
        }
      />

      <main className="flex-1 p-4 md:p-6">
        <Card ref={receiptRef} className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:max-w-none print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-6">
            <div className="flex items-center gap-3">
              {cfg.showLogo && (
                institute.logoUrl ? (
                  <img src={institute.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-brand text-white font-display text-xl font-bold">
                    {institute.name.slice(0, 2).toUpperCase()}
                  </div>
                )
              )}
              <div>
                <h2 className="font-display text-2xl font-bold">{institute.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {institute.address}
                  {cfg.showGst && institute.gstNumber ? ` · GST: ${institute.gstNumber}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {contact.phone}
                  {contact.email ? ` · ${contact.email}` : ""}
                  {contact.website ? ` · ${contact.website}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fee Receipt</p>
              <p className="font-mono text-lg font-bold">{payment.receiptNo}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(payment.date)}</p>
            </div>
          </div>

          {/* Student */}
          <div className="grid grid-cols-2 gap-6 py-6 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Received from</p>
              <p className="mt-1 font-display text-base font-bold">{student.name}</p>
              <p className="text-muted-foreground">Roll No: {student.rollNo}</p>
              <p className="text-muted-foreground">{student.phone}</p>
              {student.parentName && <p className="text-muted-foreground">Parent: {student.parentName}</p>}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Academic</p>
              <p className="mt-1 font-medium">{batch?.name ?? student.course}</p>
              {student.standard && (
                <p className="text-xs text-muted-foreground">
                  {student.standard} · {student.board} · {student.medium}
                </p>
              )}
              {student.examCategory && (
                <p className="text-xs text-muted-foreground">
                  {student.examCategory} {batch?.examYear ?? ""}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div className="py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="border-t">
                <tr>
                  <td className="py-3">
                    Fee payment — {batch?.name ?? student.course}
                    {payment.note && <p className="text-xs text-muted-foreground">{payment.note}</p>}
                  </td>
                  <td className="py-3 text-right font-medium">{inr(payment.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <Row label="Amount received" value={inr(payment.amount)} bold />
            <Row label="Payment mode" value={payment.mode} />
            <Separator className="my-2" />
            <Row label="Course fee" value={inr(student.courseFee || student.totalFee)} />
            {student.admissionFee > 0 && <Row label="Admission fee" value={inr(student.admissionFee)} />}
            {student.discount > 0 && <Row label="Discount" value={`- ${inr(student.discount)}`} />}
            <Row label="Total paid" value={inr(student.paidFee)} />
            <Row label="Pending balance" value={inr(balance)} bold tone={balance > 0 ? "danger" : "success"} />
          </div>

          {cfg.showFooter && (
            <div className="mt-10 space-y-4 border-t pt-6 text-xs text-muted-foreground">
              {cfg.termsAndConditions && (
                <div>
                  <p className="font-semibold text-foreground">Terms &amp; Conditions</p>
                  <p className="mt-1 whitespace-pre-line">{cfg.termsAndConditions}</p>
                </div>
              )}
              <div className="flex items-end justify-between">
                <p className="max-w-xs">{cfg.footerText}</p>
                <div className="text-right">
                  <div className="h-10 w-32 border-b border-dashed" />
                  <p className="mt-1">{cfg.authorizedSignatory}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "";
  return (
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-display font-bold" : ""} ${cls}`}>{value}</span>
    </div>
  );
}
