import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Receipt as ReceiptIcon, Download, ChevronRight } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { fmtDate, inr } from "@/lib/format";
import { paymentsListQuery, studentsListQuery, usePaymentsList, useStudentsList } from "@/lib/query/lists";

export const Route = createFileRoute("/receipts/")({
  head: () => ({
    meta: [
      { title: "Receipts — Vidyafee" },
      { name: "description", content: "All receipts, ready to print, download or share on WhatsApp." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({ ...studentsListQuery, revalidateIfStale: true }),
      context.queryClient.ensureQueryData({ ...paymentsListQuery, revalidateIfStale: true }),
    ]),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const studentsQ = useStudentsList();
  const paymentsQ = usePaymentsList();
  const students = studentsQ.data ?? [];
  const payments = paymentsQ.data ?? [];
  const fetching = studentsQ.isFetching || paymentsQ.isFetching;
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return payments
      .map((p) => ({
        ...p,
        student: students.find((s) => s.id === p.studentId),
      }))
      .filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.receiptNo.toLowerCase().includes(q) || (p.student?.name.toLowerCase().includes(q) ?? false);
      });
  }, [payments, students, search]);

  return (
    <>
      <AppHeader title="Receipts" subtitle={`${payments.length} total receipts generated`} />
      <main className={`flex-1 space-y-4 p-4 md:p-6 ${fetching ? "opacity-70 transition-opacity" : ""}`}>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by receipt no or student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline"><Download className="h-4 w-4" /> Export CSV</Button>
          </CardContent>
        </Card>

        <p className="px-1 text-xs text-muted-foreground md:hidden">
          Tap a receipt to view, print or share it.
        </p>
        <div className="hidden rounded-xl border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-12 md:gap-3">
          <div className="col-span-2">Receipt no</div>
          <div className="col-span-4">Student</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Mode</div>
          <div className="col-span-1 text-right">Amount</div>
          <div className="col-span-1 text-right" />
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              No receipts found.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile: self-contained card per receipt, independent of the
                desktop table below - no shared source-order/grid-column
                mapping between the two (this is exactly what broke here:
                the mode badge was moved for this card layout by merging
                it into a different, wider grid item, which also silently
                shifted every desktop column after it). */}
            <div className="space-y-3 md:hidden">
              {rows.map((p) => (
                <Link
                  key={p.id}
                  to="/receipts/$id"
                  params={{ id: p.id }}
                  className="block space-y-2 rounded-xl border bg-card px-5 py-3 shadow transition hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{p.receiptNo}</span>
                    <Badge variant="secondary">{p.mode}</Badge>
                  </div>
                  <div className="truncate">
                    <p className="font-medium">{p.student?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.student?.rollNo}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{fmtDate(p.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-success">{inr(p.amount)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: a genuinely separate row markup, 6 grid items
                matching the 6 header columns 1:1 - not derived from or
                shared with the mobile card markup above. */}
            <div className="hidden space-y-3 md:block">
              {rows.map((p) => (
                <Link
                  key={p.id}
                  to="/receipts/$id"
                  params={{ id: p.id }}
                  className="grid grid-cols-12 items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow transition hover:bg-accent/40"
                >
                  <div className="col-span-2 font-mono text-sm">{p.receiptNo}</div>
                  <div className="col-span-4 truncate">
                    <p className="font-medium">{p.student?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.student?.rollNo}</p>
                  </div>
                  <div className="col-span-2 text-sm">{fmtDate(p.date)}</div>
                  <div className="col-span-2"><Badge variant="secondary">{p.mode}</Badge></div>
                  <div className="col-span-1 text-right font-display font-bold text-success">{inr(p.amount)}</div>
                  <div className="col-span-1 text-right">
                    <ReceiptIcon className="ml-auto h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
