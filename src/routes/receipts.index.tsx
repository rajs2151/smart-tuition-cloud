import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Receipt as ReceiptIcon, Download } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { listPayments, listStudents } from "@/lib/data/adapter";
import { fmtDate, inr } from "@/lib/format";

const q = {
  queryKey: ["receipts-page"],
  queryFn: async () => ({
    students: await listStudents(),
    payments: await listPayments(),
  }),
};

export const Route = createFileRoute("/receipts/")({
  head: () => ({
    meta: [
      { title: "Receipts — Vidyafee" },
      { name: "description", content: "All receipts, ready to print, download or share on WhatsApp." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const { data } = useSuspenseQuery(q);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return data.payments
      .map((p) => ({
        ...p,
        student: data.students.find((s) => s.id === p.studentId),
      }))
      .filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.receiptNo.toLowerCase().includes(q) || (p.student?.name.toLowerCase().includes(q) ?? false);
      });
  }, [data, search]);

  return (
    <>
      <AppHeader title="Receipts" subtitle={`${data.payments.length} total receipts generated`} />
      <main className="flex-1 space-y-4 p-4 md:p-6">
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

        <Card>
          <div className="hidden md:grid grid-cols-12 gap-3 border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-2">Receipt no</div>
            <div className="col-span-4">Student</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Mode</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1 text-right" />
          </div>
          <div className="divide-y">
            {rows.map((p) => (
              <Link
                key={p.id}
                to="/receipts/$id"
                params={{ id: p.id }}
                className="grid grid-cols-12 items-center gap-3 px-5 py-3 transition hover:bg-accent/40"
              >
                <div className="col-span-6 md:col-span-2 font-mono text-sm">{p.receiptNo}</div>
                <div className="col-span-12 md:col-span-4 truncate">
                  <p className="font-medium">{p.student?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{p.student?.rollNo}</p>
                </div>
                <div className="col-span-6 md:col-span-2 text-sm">{fmtDate(p.date)}</div>
                <div className="col-span-6 md:col-span-2"><Badge variant="secondary">{p.mode}</Badge></div>
                <div className="col-span-6 md:col-span-1 font-display font-bold text-success md:text-right">{inr(p.amount)}</div>
                <div className="hidden md:block md:col-span-1 text-right">
                  <ReceiptIcon className="ml-auto h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
            {rows.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">No receipts found.</div>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
