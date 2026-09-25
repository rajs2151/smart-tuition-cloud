import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, FileText, ChevronRight, Loader2, Share2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listAttendanceAbsences, listAttendanceSessions } from "@/lib/data/adapter";
import { fmtDate, todayLocalISO } from "@/lib/format";
import { exportPagesToPdf, renderPagesToPdfFile } from "@/lib/pdf/export";
import { useSettings } from "@/lib/settings/store";
import {
  attendanceReportFileName,
  buildAttendanceReport,
  downloadAttendanceReport,
  reportTitle,
  type AttendanceReport,
} from "@/lib/reports/attendance-report";
import type { Batch, Student } from "@/lib/data/types";
import { AttendanceReportPdf } from "./attendance-report-pdf";

const RANGE_DAYS = 30;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISO(d);
}

type ExportKind = "excel" | "pdf" | "share";

type Period = "today" | "yesterday" | "7d" | "30d" | "this-month" | "last-month" | "custom";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "this-month": "This month",
  "last-month": "Last month",
  custom: "Custom range",
};

function periodRange(period: Exclude<Period, "custom">): { from: string; to: string } {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: toISO(now), to: toISO(now) };
    case "yesterday":
      return { from: daysAgoISO(1), to: daysAgoISO(1) };
    case "7d":
      return { from: daysAgoISO(6), to: toISO(now) };
    case "30d":
      // Same bounds as the batch cards' 30-day window, so both share one cache entry.
      return { from: daysAgoISO(RANGE_DAYS), to: toISO(now) };
    case "this-month":
      return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
    case "last-month":
      return {
        from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
  }
}

const sessionsQuery = (from: string, to: string) => ({
  queryKey: ["attendance-sessions-range", from, to] as const,
  queryFn: () => listAttendanceSessions(from, to),
});
const absencesQuery = (from: string, to: string) => ({
  queryKey: ["attendance-absences-range", from, to] as const,
  queryFn: () => listAttendanceAbsences(from, to),
});

/** Reports landing page — institute-wide snapshot over the last 30 days,
 *  an absent-students Excel/PDF (and WhatsApp share) for any period and
 *  batch, then one card
 *  per batch to drill into its full day-by-day history (BatchDayList). */
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

  const overviewSessions = useQuery(sessionsQuery(fromDate, today));
  const sessions = useMemo(() => overviewSessions.data ?? [], [overviewSessions.data]);
  const takenSessions = sessions.filter((s) => s.status === "taken");

  const todaysSessionsBatchIds = useMemo(
    () => new Set(sessions.filter((s) => s.sessionDate === today).map((s) => s.batchId)),
    [sessions, today],
  );
  const notYetTakenToday = batches.filter((b) => !todaysSessionsBatchIds.has(b.id));

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <ReportDownloadCard batches={batches} students={students} />

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
                    Last taken {fmtDate(lastSessionDate)}
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

function ReportDownloadCard({ batches, students }: { batches: Batch[]; students: Student[] }) {
  const qc = useQueryClient();
  const { institute } = useSettings();
  const today = todayLocalISO();

  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(() => daysAgoISO(RANGE_DAYS));
  const [customTo, setCustomTo] = useState(today);
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [pdfReport, setPdfReport] = useState<AttendanceReport | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    const probe = new File([""], "probe.pdf", { type: "application/pdf" });
    setCanShareFiles(!!navigator.canShare?.({ files: [probe] }));
  }, []);

  const { from, to } =
    period === "custom" ? { from: customFrom, to: customTo } : periodRange(period);
  const rangeError =
    !from || !to
      ? "Pick both a start and an end date."
      : from > to
        ? "Start date must be on or before the end date."
        : to > today
          ? "End date can't be in the future."
          : null;

  const scopeBatches = useMemo(
    () => (batchFilter === "all" ? batches : batches.filter((b) => b.id === batchFilter)),
    [batches, batchFilter],
  );
  const scopeLabel = batchFilter === "all" ? "All batches" : (scopeBatches[0]?.name ?? "Batch");

  const sessionsQ = useQuery({ ...sessionsQuery(from, to), enabled: !rangeError });
  const absencesQ = useQuery({ ...absencesQuery(from, to), enabled: !rangeError });
  const loading = !rangeError && (sessionsQ.isPending || absencesQ.isPending);
  const loadError = sessionsQ.error ?? absencesQ.error;

  const preview = useMemo(() => {
    if (!sessionsQ.data || !absencesQ.data) return null;
    return buildAttendanceReport({
      instituteName: institute.name,
      scopeLabel,
      students,
      batches: scopeBatches,
      sessions: sessionsQ.data,
      absences: absencesQ.data,
      fromDate: from,
      toDate: to,
    });
  }, [
    sessionsQ.data,
    absencesQ.data,
    institute.name,
    scopeLabel,
    students,
    scopeBatches,
    from,
    to,
  ]);

  const blocker = rangeError
    ? rangeError
    : loading
      ? null
      : loadError
        ? loadError instanceof Error
          ? loadError.message
          : "Could not load attendance for this range."
        : preview && preview.sections.length === 0
          ? period === "today"
            ? "Attendance hasn't been taken yet today."
            : "No attendance was taken in this range."
          : null;
  const canExport = !blocker && !loading && !!preview && exporting === null;

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      // Always re-read from the server so the file reflects attendance
      // marked moments ago, not the 30s-stale cached preview.
      const [freshSessions, freshAbsences] = await Promise.all([
        qc.fetchQuery({ ...sessionsQuery(from, to), staleTime: 0 }),
        qc.fetchQuery({ ...absencesQuery(from, to), staleTime: 0 }),
      ]);
      const report = buildAttendanceReport({
        instituteName: institute.name,
        scopeLabel,
        students,
        batches: scopeBatches,
        sessions: freshSessions,
        absences: freshAbsences,
        fromDate: from,
        toDate: to,
      });
      if (report.sections.length === 0) {
        throw new Error("No attendance was taken in this range.");
      }

      if (kind === "excel") {
        await downloadAttendanceReport(report);
        toast.success("Excel report downloaded");
      } else {
        flushSync(() => setPdfReport(report));
        await document.fonts?.ready;
        const pages = Array.from(
          pdfRef.current?.querySelectorAll<HTMLElement>("[data-pdf-page]") ?? [],
        );
        if (pages.length === 0) throw new Error("Could not lay out the PDF.");
        const fileName = attendanceReportFileName(report, "pdf");
        if (kind === "share") {
          const file = await renderPagesToPdfFile(pages, fileName);
          if (!file) throw new Error("Could not generate the PDF");
          try {
            await navigator.share({ files: [file], title: reportTitle(report) });
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
            // Share needs a recent tap; if generating took too long the
            // browser refuses, so fall back to a normal download.
            await exportPagesToPdf(pages, fileName);
            toast.success("PDF downloaded — share it from your Downloads");
          }
        } else {
          await exportPagesToPdf(pages, fileName);
          toast.success("PDF report downloaded");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setPdfReport(null);
      setExporting(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="font-display font-bold leading-tight">Download report</p>
          <p className="text-xs text-muted-foreground">
            Class name, date and the names of absent students — ready to share in the class WhatsApp
            group.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="attendance-report-period">Period</Label>
            <Select
              value={period}
              onValueChange={(v) => {
                const next = v as Period;
                if (next === "custom" && period !== "custom") {
                  setCustomFrom(from);
                  setCustomTo(to);
                }
                setPeriod(next);
              }}
            >
              <SelectTrigger id="attendance-report-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendance-report-from">From</Label>
            <Input
              id="attendance-report-from"
              type="date"
              value={from}
              max={today}
              disabled={period !== "custom"}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendance-report-to">To</Label>
            <Input
              id="attendance-report-to"
              type="date"
              value={to}
              max={today}
              disabled={period !== "custom"}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendance-report-batch">Batch</Label>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger id="attendance-report-batch" className="w-full">
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
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={`text-xs ${blocker ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
            aria-live="polite"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading attendance…
              </span>
            ) : blocker ? (
              blocker
            ) : preview ? (
              `${preview.totals.sessions} class${preview.totals.sessions === 1 ? "" : "es"} recorded · ${preview.totals.absences} absent`
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={!canExport}
              onClick={() => handleExport("excel")}
            >
              {exporting === "excel" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              {exporting === "excel" ? "Generating…" : "Excel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={!canExport}
              onClick={() => handleExport("pdf")}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {exporting === "pdf" ? "Generating…" : "PDF"}
            </Button>
            {canShareFiles && (
              <Button
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!canExport}
                onClick={() => handleExport("share")}
              >
                {exporting === "share" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {exporting === "share" ? "Preparing…" : "Share"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      {pdfReport && <AttendanceReportPdf ref={pdfRef} report={pdfReport} />}
    </Card>
  );
}
