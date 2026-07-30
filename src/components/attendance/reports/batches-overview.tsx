import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, FileText, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { listAttendanceAbsences, listAttendanceSessions } from "@/lib/data/adapter";
import { todayLocalISO } from "@/lib/format";
import { exportElementToPdf } from "@/lib/pdf/export";
import {
  buildStudentAttendanceRows,
  downloadAttendanceReport,
} from "@/lib/reports/attendance-report";
import type { Batch, Student } from "@/lib/data/types";

const RANGE_DAYS = 30;

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Reports landing page — institute-wide snapshot over the last 30 days,
 *  then one card per batch to drill into its full day-by-day history
 *  (BatchDayList), replacing the old single flat list. */
export function BatchesOverview({
  batches,
  students,
  onSelectBatch,
}: {
  batches: Batch[];
  students: Student[];
  onSelectBatch: (batch: Batch) => void;
}) {
  const today = todayLocalISO();
  const fromDate = useMemo(() => daysAgoISO(RANGE_DAYS), []);
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions-range", fromDate, today],
    queryFn: () => listAttendanceSessions(fromDate, today),
  });
  const absencesQuery = useQuery({
    queryKey: ["attendance-absences-range", fromDate, today],
    queryFn: () => listAttendanceAbsences(fromDate, today),
  });
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const absences = useMemo(() => absencesQuery.data ?? [], [absencesQuery.data]);

  const takenSessions = sessions.filter((s) => s.status === "taken");
  const totalStudentDays = takenSessions.reduce((a, s) => a + s.totalStudents, 0);
  const totalAbsentDays = takenSessions.reduce((a, s) => a + s.absentCount, 0);
  const overallPct =
    totalStudentDays > 0 ? Math.round((1 - totalAbsentDays / totalStudentDays) * 1000) / 10 : null;

  const todaysSessionsBatchIds = useMemo(
    () => new Set(sessions.filter((s) => s.sessionDate === today).map((s) => s.batchId)),
    [sessions, today],
  );
  const notYetTakenToday = batches.filter((b) => !todaysSessionsBatchIds.has(b.id));

  const studentRows = useMemo(
    () => buildStudentAttendanceRows(students, batches, sessions, absences, fromDate, today),
    [students, batches, sessions, absences, fromDate, today],
  );
  const topAbsentees = [...studentRows]
    .sort((a, b) => a.attendancePct - b.attendancePct)
    .slice(0, 5);

  const batchStats = useMemo(() => {
    return batches.map((b) => {
      const batchTaken = takenSessions.filter((s) => s.batchId === b.id);
      const total = batchTaken.reduce((a, s) => a + s.totalStudents, 0);
      const absent = batchTaken.reduce((a, s) => a + s.absentCount, 0);
      const pct = total > 0 ? Math.round((1 - absent / total) * 1000) / 10 : null;
      const lastSession = sessions
        .filter((s) => s.batchId === b.id)
        .sort((a, c) => c.sessionDate.localeCompare(a.sessionDate))[0];
      return {
        batch: b,
        pct,
        lastSessionDate: lastSession?.sessionDate,
        markedToday: todaysSessionsBatchIds.has(b.id),
      };
    });
  }, [batches, takenSessions, sessions, todaysSessionsBatchIds]);

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await downloadAttendanceReport(studentRows, fromDate, today);
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
      await exportElementToPdf(reportRef.current, `Attendance_Report_${fromDate}_to_${today}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div ref={reportRef} className="space-y-4 bg-background">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Overall attendance (30d)</p>
              <p className="font-display text-2xl font-bold">
                {overallPct !== null ? `${overallPct}%` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sessions taken (30d)</p>
              <p className="font-display text-2xl font-bold">{takenSessions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Not yet marked today</p>
              <p className="font-display text-2xl font-bold">
                {notYetTakenToday.length} / {batches.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {topAbsentees.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lowest attendance, last 30 days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topAbsentees.map((r) => (
                <div
                  key={`${r.studentName}-${r.batchName}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.batchName}</p>
                  </div>
                  <Badge variant={r.attendancePct < 75 ? "destructive" : "secondary"}>
                    {r.attendancePct}%
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={excelLoading} onClick={handleExcel}>
          <FileDown className="h-3.5 w-3.5" /> {excelLoading ? "Generating…" : "Excel"}
        </Button>
        <Button variant="outline" size="sm" disabled={pdfLoading} onClick={handlePdf}>
          <FileText className="h-3.5 w-3.5" /> {pdfLoading ? "Generating…" : "PDF"}
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Batches</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batchStats.map(({ batch, pct, lastSessionDate, markedToday }) => (
            <button
              key={batch.id}
              type="button"
              onClick={() => onSelectBatch(batch)}
              className="flex items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-display font-bold">{batch.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pct !== null ? `${pct}% · last 30 days` : "No attendance in last 30 days"}
                </p>
                {!markedToday && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Not marked today
                  </p>
                )}
                {lastSessionDate && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Last taken {lastSessionDate}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
