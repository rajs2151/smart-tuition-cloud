import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Filter, Phone } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddStudentDialog } from "@/components/add-student-dialog";
import { StudentRowMenu } from "@/components/student-row-menu";

import { initials, inr } from "@/lib/format";
import { studentsListQuery, paymentsListQuery, batchesListQuery, useStudentsList, usePaymentsList, useBatchesList } from "@/lib/query/lists";

export const Route = createFileRoute("/students/")({
  head: () => ({
    meta: [
      { title: "Students — Vidyafee" },
      { name: "description", content: "Manage student records, batches and fee status." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({ ...studentsListQuery, revalidateIfStale: true }),
      context.queryClient.ensureQueryData({ ...paymentsListQuery, revalidateIfStale: true }),
      context.queryClient.ensureQueryData({ ...batchesListQuery, revalidateIfStale: true }),
    ]),
  component: StudentsPage,
});

function StudentsPage() {
  const studentsQ = useStudentsList();
  const paymentsQ = usePaymentsList();
  const batchesQ = useBatchesList();
  const students = studentsQ.data ?? [];
  const payments = paymentsQ.data ?? [];
  const batches = batchesQ.data ?? [];
  const fetching = studentsQ.isFetching || paymentsQ.isFetching || batchesQ.isFetching;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  // Collected is derived from the payments ledger (already loaded on this
  // page), not from the cached student.paidFee column. That column is
  // reconciled by a best-effort background step after each payment; if it
  // ever fails silently, paidFee can drift out of sync with the actual
  // ledger while payments itself stays correct. Same fix as Dashboard,
  // Fees list, Batch Fee Report, and Student Details, so every screen
  // agrees.
  const collectedByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.voided) continue;
      map.set(p.studentId, (map.get(p.studentId) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);

  const filtered = useMemo(
    () =>
      students.filter((s) => {
        const collected = collectedByStudent.get(s.id) ?? 0;
        if (batch !== "all" && s.batchId !== batch) return false;
        if (status === "due") {
          if (collected >= s.totalFee - s.discount) return false;
        } else if (status === "paid") {
          if (collected < s.totalFee - s.discount) return false;
        }
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.phone.includes(q)
        );
      }),
    [students, collectedByStudent, search, batch, status],
  );

  return (
    <>
      <AppHeader
        title="Students"
        subtitle={`${students.length} total · ${students.filter((s) => s.status === "active").length} active`}
        actions={<AddStudentDialog />}
      />

      <main className={`flex-1 space-y-4 p-4 md:p-6 ${fetching ? "opacity-70 transition-opacity" : ""}`}>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, roll no or phone…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="due">Has dues</SelectItem>
                <SelectItem value="paid">Fully paid</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <div className="hidden md:grid grid-cols-12 gap-3 border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-4">Student</div>
            <div className="col-span-2">Batch</div>
            <div className="col-span-2">Fee progress</div>
            <div className="col-span-2 text-right">Due</div>
            <div className="col-span-1 text-right">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Mobile: a self-contained card per student, independent of the
              desktop table below — no shared source-order/grid-column
              mapping between the two, so a change to one can't silently
              shift the other's columns (this is exactly what broke here:
              the three-dot menu and status badge were repositioned for
              this card layout by merging them into fewer, wider grid
              items, which also silently shifted every desktop column). */}
          <div className="divide-y md:hidden">
            {filtered.map((s) => {
              const collected = collectedByStudent.get(s.id) ?? 0;
              const billed = s.totalFee - s.discount;
              const due = Math.max(0, billed - collected);
              const pct = Math.round((collected / Math.max(1, billed)) * 100);
              const batchName = batches.find((b) => b.id === s.batchId)?.name ?? s.course;
              return (
                <div
                  key={s.id}
                  onClick={() => navigate({ to: "/students/$id", params: { id: s.id } })}
                  className="cursor-pointer space-y-2 px-5 py-3 transition hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                          {initials(s.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          {s.rollNo} · <Phone className="h-3 w-3" /> {s.phone}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <StudentRowMenu student={s} />
                    </div>
                  </div>
                  <div>
                    <Badge variant="secondary" className="font-normal">{batchName}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{inr(collected)} / {inr(billed)}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-1.5 h-1.5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`font-display font-bold ${due > 0 ? "text-destructive" : "text-success"}`}>
                      {due > 0 ? inr(due) : "Cleared"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: a genuinely separate table body, 6 grid items per
              row matching the 6 header columns 1:1 - not derived from or
              shared with the mobile card markup above. */}
          <div className="hidden divide-y md:block">
            {filtered.map((s) => {
              const collected = collectedByStudent.get(s.id) ?? 0;
              const billed = s.totalFee - s.discount;
              const due = Math.max(0, billed - collected);
              const pct = Math.round((collected / Math.max(1, billed)) * 100);
              const batchName = batches.find((b) => b.id === s.batchId)?.name ?? s.course;
              return (
                <div
                  key={s.id}
                  onClick={() => navigate({ to: "/students/$id", params: { id: s.id } })}
                  className="grid cursor-pointer grid-cols-12 items-center gap-3 px-5 py-3 transition hover:bg-accent/40"
                >
                  <div className="col-span-4 flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                        {initials(s.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        {s.rollNo} · <Phone className="h-3 w-3" /> {s.phone}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="secondary" className="font-normal">{batchName}</Badge>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{inr(collected)} / {inr(billed)}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-1.5 h-1.5" />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`font-display font-bold ${due > 0 ? "text-destructive" : "text-success"}`}>
                      {due > 0 ? inr(due) : "Cleared"}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  </div>
                  <div className="col-span-1 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <StudentRowMenu student={s} />
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No students match your filters.
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
