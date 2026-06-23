import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
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

import { listBatches, listStudents } from "@/lib/data/adapter";
import { initials, inr } from "@/lib/format";

const q = {
  queryKey: ["students-page"],
  queryFn: async () => ({
    students: await listStudents(),
    batches: await listBatches(),
  }),
};

export const Route = createFileRoute("/students/")({
  head: () => ({
    meta: [
      { title: "Students — Vidyafee" },
      { name: "description", content: "Manage student records, batches and fee status." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: StudentsPage,
});

function StudentsPage() {
  const { data } = useSuspenseQuery(q);
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(
    () =>
      data.students.filter((s) => {
        if (batch !== "all" && s.batchId !== batch) return false;
        if (status === "due") {
          if (s.paidFee >= s.totalFee - s.discount) return false;
        } else if (status === "paid") {
          if (s.paidFee < s.totalFee - s.discount) return false;
        }
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.phone.includes(q)
        );
      }),
    [data.students, search, batch, status],
  );

  return (
    <>
      <AppHeader
        title="Students"
        subtitle={`${data.students.length} total · ${data.students.filter((s) => s.status === "active").length} active`}
        actions={<AddStudentDialog />}
      />

      <main className="flex-1 space-y-4 p-4 md:p-6">
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
                {data.batches.map((b) => (
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
            <div className="col-span-3">Fee progress</div>
            <div className="col-span-2 text-right">Due</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          <div className="divide-y">
            {filtered.map((s) => {
              const billed = s.totalFee - s.discount;
              const due = Math.max(0, billed - s.paidFee);
              const pct = Math.round((s.paidFee / Math.max(1, billed)) * 100);
              const batchName = data.batches.find((b) => b.id === s.batchId)?.name ?? s.course;
              return (
                <Link
                  key={s.id}
                  to="/students/$id"
                  params={{ id: s.id }}
                  className="grid grid-cols-12 items-center gap-3 px-5 py-3 transition hover:bg-accent/40"
                >
                  <div className="col-span-12 md:col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                        {initials(s.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                        {s.rollNo} · <Phone className="h-3 w-3" /> {s.phone}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Badge variant="secondary" className="font-normal">{batchName}</Badge>
                  </div>
                  <div className="col-span-12 md:col-span-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{inr(s.paidFee)} / {inr(billed)}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-1.5 h-1.5" />
                  </div>
                  <div className="col-span-6 md:col-span-2 md:text-right">
                    <span className={`font-display font-bold ${due > 0 ? "text-destructive" : "text-success"}`}>
                      {due > 0 ? inr(due) : "Cleared"}
                    </span>
                  </div>
                  <div className="col-span-12 md:col-span-1 md:text-right">
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  </div>
                </Link>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No students match your filters.
              </div>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
