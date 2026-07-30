import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarOff,
  Ban,
  MessageCircle,
  FileDown,
  FileText,
  Lock,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { NotifyAbsenteesDialog } from "@/components/attendance/notify-absentees-dialog";

import {
  listAttendanceAbsences,
  listAttendanceSessions,
  listBatches,
  listStudents,
  loadAttendanceForBatch,
  markAttendanceStatus,
  saveAttendance,
} from "@/lib/data/adapter";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { useSettings } from "@/lib/settings/store";
import { fmtDate, todayLocalISO } from "@/lib/format";
import { exportElementToPdf } from "@/lib/pdf/export";
import {
  buildStudentAttendanceRows,
  downloadAttendanceReport,
} from "@/lib/reports/attendance-report";
import type { Batch } from "@/lib/data/types";

const pageQuery = {
  queryKey: ["attendance-page"],
  queryFn: async () => ({
    batches: await listBatches(),
    students: await listStudents(),
  }),
};

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Vidyafee" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery),
  component: AttendancePage,
});

function AttendancePage() {
  const { data } = useSuspenseQuery(pageQuery);
  const { role } = useSession();
  const allowed = can(role, "attendance");
  const activeBatches = data.batches.filter((b) => !b.deleted && b.active);

  const [batchId, setBatchId] = useState<string>(activeBatches[0]?.id ?? "");
  useEffect(() => {
    if (!batchId && activeBatches.length > 0) setBatchId(activeBatches[0].id);
  }, [activeBatches, batchId]);

  const batch = data.batches.find((b) => b.id === batchId);

  if (!allowed) {
    return (
      <>
        <AppHeader title="Attendance" />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              Your role doesn&apos;t have access to Attendance.
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Attendance"
        subtitle={`${activeBatches.length} active batches`}
        actions={
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {activeBatches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {activeBatches.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              No active batches yet. Create a batch first.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="mark" className="space-y-4">
            <TabsList>
              <TabsTrigger value="mark">Take Attendance</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="mark">
              {batch && <MarkAttendanceTab batch={batch} allStudents={data.students} />}
            </TabsContent>
            <TabsContent value="reports">
              <AttendanceReportsTab batches={activeBatches} students={data.students} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </>
  );
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function MarkAttendanceTab({
  batch,
  allStudents,
}: {
  batch: Batch;
  allStudents: import("@/lib/data/types").Student[];
}) {
  const qc = useQueryClient();
  const { role } = useSession();
  const { attendance: attendanceSettings } = useSettings();
  const isPrivileged = role === "owner" || role === "admin";

  const [sessionDate, setSessionDate] = useState(todayLocalISO());
  const students = allStudents.filter(
    (s) => s.batchId === batch.id && !s.deleted && s.status === "active",
  );

  const attendanceQuery = useQuery({
    queryKey: ["attendance", batch.id, sessionDate],
    queryFn: () => loadAttendanceForBatch(batch.id, sessionDate),
  });

  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (attendanceQuery.data) setAbsentIds(new Set(attendanceQuery.data.absentStudentIds));
  }, [attendanceQuery.data]);

  const [saving, setSaving] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [lastAbsentStudents, setLastAbsentStudents] = useState<typeof students>([]);

  const existingSession = attendanceQuery.data?.session ?? null;
  const locked =
    !!existingSession &&
    existingSession.status === "taken" &&
    !isPrivileged &&
    (existingSession.sessionDate !== todayLocalISO() ||
      (!!attendanceSettings.lockTime && nowHHMM() > attendanceSettings.lockTime));

  const toggle = (studentId: string) => {
    if (locked) return;
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAttendance(batch, sessionDate, [...absentIds]);
      await qc.invalidateQueries({ queryKey: ["attendance", batch.id, sessionDate] });
      const absentStudents = students.filter((s) => absentIds.has(s.id));
      setLastAbsentStudents(absentStudents);
      if (absentStudents.length > 0) {
        toast.success(`Attendance saved · ${absentStudents.length} absent`, {
          action: {
            label: "Send WhatsApp",
            onClick: () => setNotifyOpen(true),
          },
        });
      } else {
        toast.success("Attendance saved · everyone present");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: "holiday" | "cancelled") => {
    setSaving(true);
    try {
      await markAttendanceStatus(batch, sessionDate, status);
      await qc.invalidateQueries({ queryKey: ["attendance", batch.id, sessionDate] });
      toast.success(`Marked as ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update attendance status.");
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = () => {
    if (!existingSession) return <Badge variant="outline">Not yet taken</Badge>;
    if (existingSession.status === "holiday") return <Badge variant="secondary">Holiday</Badge>;
    if (existingSession.status === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
    return (
      <Badge className="bg-success/15 text-success" variant="secondary">
        Taken
      </Badge>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="font-display font-bold leading-tight">{batch.name}</p>
              <p className="text-xs text-muted-foreground">
                {students.length} students · {absentIds.size} marked absent
              </p>
            </div>
            {statusBadge()}
            {locked && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Locked — ask an owner/admin to edit
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={sessionDate}
              max={todayLocalISO()}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setStatus("holiday")}
            >
              <CalendarOff className="h-3.5 w-3.5" /> Holiday
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setStatus("cancelled")}
            >
              <Ban className="h-3.5 w-3.5" /> Cancel lecture
            </Button>
          </div>
        </CardContent>
      </Card>

      {existingSession && existingSession.status !== "taken" ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            {existingSession.status === "holiday"
              ? "Marked as a holiday."
              : "Marked as a cancelled lecture."}{" "}
            No attendance recorded for this session.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <AttendanceGrid
              students={students}
              absentIds={absentIds}
              onToggle={toggle}
              disabled={locked}
            />
          </CardContent>
        </Card>
      )}

      {(!existingSession || existingSession.status === "taken") && (
        <div className="sticky bottom-4 z-10 flex justify-center">
          <Card className="shadow-lg">
            <CardContent className="flex items-center gap-3 p-3">
              <Button size="lg" disabled={saving || locked} onClick={save}>
                <CalendarCheck className="h-4 w-4" />
                {saving ? "Saving…" : `Save Attendance (${absentIds.size} absent)`}
              </Button>
              {lastAbsentStudents.length > 0 && (
                <Button size="lg" variant="outline" onClick={() => setNotifyOpen(true)}>
                  <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  Notify {lastAbsentStudents.length} parent
                  {lastAbsentStudents.length > 1 ? "s" : ""}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <NotifyAbsenteesDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        batch={batch}
        sessionDate={sessionDate}
        absentStudents={lastAbsentStudents}
        attendanceLanguage={attendanceSettings.language}
      />
    </div>
  );
}

function AttendanceReportsTab({
  batches,
  students,
}: {
  batches: Batch[];
  students: import("@/lib/data/types").Student[];
}) {
  const today = todayLocalISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [reportBatchId, setReportBatchId] = useState<string>("all");
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const filterBatchId = reportBatchId === "all" ? undefined : reportBatchId;

  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions-range", fromDate, toDate, filterBatchId],
    queryFn: () => listAttendanceSessions(fromDate, toDate, filterBatchId),
  });
  const absencesQuery = useQuery({
    queryKey: ["attendance-absences-range", fromDate, toDate, filterBatchId],
    queryFn: () => listAttendanceAbsences(fromDate, toDate, filterBatchId),
  });

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const absences = useMemo(() => absencesQuery.data ?? [], [absencesQuery.data]);

  const takenSessions = sessions.filter((s) => s.status === "taken");
  const totalStudentDays = takenSessions.reduce((a, s) => a + s.totalStudents, 0);
  const totalAbsentDays = takenSessions.reduce((a, s) => a + s.absentCount, 0);
  const overallPct =
    totalStudentDays > 0 ? Math.round((1 - totalAbsentDays / totalStudentDays) * 1000) / 10 : null;

  const todaysSessionsBatchIds = new Set(
    sessions.filter((s) => s.sessionDate === today).map((s) => s.batchId),
  );
  const notYetTakenToday = batches.filter((b) => !todaysSessionsBatchIds.has(b.id));

  const studentRows = useMemo(
    () =>
      buildStudentAttendanceRows(
        students.filter((s) => !filterBatchId || s.batchId === filterBatchId),
        batches,
        sessions,
        absences,
        fromDate,
        toDate,
      ),
    [students, batches, sessions, absences, fromDate, toDate, filterBatchId],
  );

  const topAbsentees = [...studentRows]
    .sort((a, b) => a.attendancePct - b.attendancePct)
    .slice(0, 10);

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await downloadAttendanceReport(studentRows, fromDate, toDate);
      toast.success("Attendance report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setExcelLoading(false);
    }
  };

  const handlePdf = async () => {
    if (!reportRef.current) return;
    setPdfLoading(true);
    try {
      await exportElementToPdf(reportRef.current, `Attendance_Report_${fromDate}_to_${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={toDate}
              min={fromDate}
              max={today}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Batch</Label>
            <Select value={reportBatchId} onValueChange={setReportBatchId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={excelLoading} onClick={handleExcel}>
              <FileDown className="h-3.5 w-3.5" /> {excelLoading ? "Generating…" : "Excel"}
            </Button>
            <Button variant="outline" size="sm" disabled={pdfLoading} onClick={handlePdf}>
              <FileText className="h-3.5 w-3.5" /> {pdfLoading ? "Generating…" : "PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div ref={reportRef} className="space-y-4 bg-background p-1">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Overall attendance</p>
              <p className="font-display text-2xl font-bold">
                {overallPct !== null ? `${overallPct}%` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sessions taken in range</p>
              <p className="font-display text-2xl font-bold">{takenSessions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Not yet marked today</p>
              <p className="font-display text-2xl font-bold">
                {notYetTakenToday.length} / {batches.length}
              </p>
              {notYetTakenToday.length > 0 && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {notYetTakenToday.map((b) => b.name).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lowest attendance (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topAbsentees.length === 0 && (
              <p className="text-sm text-muted-foreground">No attendance data in this range yet.</p>
            )}
            {topAbsentees.map((r) => (
              <div
                key={`${r.studentName}-${r.batchName}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{r.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.batchName} · {r.takenSessions} sessions
                  </p>
                </div>
                <Badge variant={r.attendancePct < 75 ? "destructive" : "secondary"}>
                  {r.attendancePct}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
