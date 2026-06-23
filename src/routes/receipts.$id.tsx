import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, MessageCircle, Printer } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { getStudent, listPayments } from "@/lib/data/adapter";
import { fmtDate, inr } from "@/lib/format";

export const Route = createFileRoute("/receipts/$id")({
  loader: async ({ params, context }) => {
    return context.queryClient.ensureQueryData({
      queryKey: ["receipt", params.id],
      queryFn: async () => {
        const all = await listPayments();
        const payment = all.find((p) => p.id === params.id);
        if (!payment) throw notFound();
        const student = await getStudent(payment.studentId);
        return { payment, student };
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
      return { payment, student };
    },
  });
  const { payment, student } = data;
  if (!student) return null;

  const billed = student.totalFee - student.discount;
  const balance = Math.max(0, billed - student.paidFee);

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
            <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Download PDF</Button>
            <Button variant="outline" size="sm"><MessageCircle className="h-4 w-4" /> Send WhatsApp</Button>
          </>
        }
      />

      <main className="flex-1 p-4 md:p-6">
        <Card className="mx-auto max-w-2xl p-8 print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-brand text-white font-display text-xl font-bold">
                DC
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold">Dnyanpeeth Classes</h2>
                <p className="text-xs text-muted-foreground">FC Road, Pune · GST: 27ABCDE1234F1Z5</p>
                <p className="text-xs text-muted-foreground">+91 98765 43210 · hello@dnyanpeeth.in</p>
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
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Course</p>
              <p className="mt-1 font-medium">{student.course}</p>
              <p className="text-muted-foreground">Admission: {fmtDate(student.admissionDate)}</p>
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
                    Fee payment — {student.course}
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
            <Row label="Total course fee" value={inr(student.totalFee)} />
            <Row label="Discount" value={`- ${inr(student.discount)}`} />
            <Row label="Total paid" value={inr(student.paidFee)} />
            <Row label="Balance due" value={inr(balance)} bold tone={balance > 0 ? "danger" : "success"} />
          </div>

          <div className="mt-10 flex items-end justify-between border-t pt-6 text-xs text-muted-foreground">
            <div>
              <p>Thank you for your payment.</p>
              <p>This is a computer-generated receipt.</p>
            </div>
            <div className="text-right">
              <div className="h-10 w-32 border-b border-dashed" />
              <p className="mt-1">Authorised signatory</p>
            </div>
          </div>
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
