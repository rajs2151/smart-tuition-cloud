import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  IndianRupee,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Receipt as ReceiptIcon,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  getStudent,
  listBatches,
  listPaymentsByStudent,
} from "@/lib/data/adapter";
import { fmtDate, initials, inr } from "@/lib/format";

export const Route = createFileRoute("/students/$id")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["student", params.id],
      queryFn: async () => {
        const student = await getStudent(params.id);
        if (!student) return null;
        const [payments, batches] = await Promise.all([
          listPaymentsByStudent(params.id),
          listBatches(),
        ]);
        return { student, payments, batches };
      },
    });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.student?.name ?? "Student"} — Vidyafee` }],
  }),
  notFoundComponent: () => (
    <div className="flex h-full items-center justify-center p-12">
      <p className="text-muted-foreground">Student not found.</p>
    </div>
  ),
  component: StudentDetail,
});

function StudentDetail() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery({
    queryKey: ["student", params.id],
    queryFn: async () => {
      const student = await getStudent(params.id);
      const [payments, batches] = await Promise.all([
        listPaymentsByStudent(params.id),
        listBatches(),
      ]);
      return { student: student!, payments, batches };
    },
  });
  const { student: s, payments, batches } = data;
  const batch = batches.find((b) => b.id === s.batchId);
  const billed = s.totalFee - s.discount;
  const due = Math.max(0, billed - s.paidFee);
  const pct = Math.round((s.paidFee / Math.max(1, billed)) * 100);

  return (
    <>
      <AppHeader
        title={s.name}
        subtitle={`${s.rollNo} · Admitted ${fmtDate(s.admissionDate)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/students"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Record payment
            </Button>
            <Button size="sm" variant="outline">
              <MessageCircle className="h-4 w-4" /> Send WhatsApp reminder
            </Button>
          </>
        }
      />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile */}
          <Card className="lg:col-span-1">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                    {initials(s.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-display text-lg font-bold">{s.name}</h2>
                  <Badge variant="secondary" className="mt-1">{batch?.name}</Badge>
                </div>
              </div>
              <Separator />
              <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={s.phone} />
              <Row icon={<Phone className="h-4 w-4" />} label="Parent" value={s.parentPhone || "—"} />
              <Row icon={<Mail className="h-4 w-4" />} label="Email" value={s.email || "—"} />
              <Row icon={<MapPin className="h-4 w-4" />} label="Address" value={s.address || "—"} />
              <Row icon={<Calendar className="h-4 w-4" />} label="Admission" value={fmtDate(s.admissionDate)} />
              <Row icon={<IndianRupee className="h-4 w-4" />} label="Course fee" value={inr(s.totalFee)} />
            </CardContent>
          </Card>

          {/* Fee summary + timeline */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fee summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Total fee" value={inr(s.totalFee)} />
                  <Stat label="Discount" value={inr(s.discount)} tone="info" />
                  <Stat label="Collected" value={inr(s.paidFee)} tone="success" />
                  <Stat label="Due" value={inr(due)} tone={due > 0 ? "danger" : "success"} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Collection progress</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <Progress value={pct} className="mt-2 h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Payment timeline</CardTitle>
                <Badge variant="outline">{payments.length} payments</Badge>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
                ) : (
                  <ol className="relative space-y-4 border-l pl-6">
                    {payments.map((p) => (
                      <li key={p.id} className="relative">
                        <span className="absolute -left-[29px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/40 p-3">
                          <div>
                            <p className="font-semibold">{inr(p.amount)} <span className="ml-1 text-xs font-normal text-muted-foreground">via {p.mode}</span></p>
                            <p className="text-xs text-muted-foreground">{fmtDate(p.date)} · {p.receiptNo}</p>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/receipts/$id" params={{ id: p.id }}>
                              <ReceiptIcon className="h-3.5 w-3.5" /> View receipt
                            </Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | "info" }) {
  const cls =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "info" ? "text-info" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
