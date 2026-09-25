import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, FileDown, FileText, Loader2, Share2, UserCheck } from "lucide-react";

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
  attendanceReportText,
  buildAttendanceReport,
  downloadAttendanceReport,
  reportTitle,
  sectionSummary,
  type AttendanceReport,
} from "@/lib/reports/attendance-report";
import type { Batch, Student } from "@/lib/data/types";
import { AttendanceReportPdf } from "./attendance-report-pdf";

const CUSTOM_DEFAULT_DAYS = 30;
// The files always contain everything; this only bounds the on-screen list.
const PREVIEW_SECTIONS = 50;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISO(d);
}

type ExportKind = "excel" | "pdf" | "share" | "copy";

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
      return { from: daysAgoISO(30), to: toISO(now) };
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

/** Copies text that is still being fetched. Safari only allows clipboard
 *  writes inside the tap that triggered them, so the write must start
 *  before the network round-trip; ClipboardItem accepts a promise for that. */
async function copyToClipboard(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}

/** Reports tab — the absent-students report (preview, Excel, PDF, WhatsApp
 *  share, copy as text) for any period, defaulting to the batch picked in
 *  the page header. */
export function AttendanceReportDownload({
  batches,
  students,
  selectedBatchId,
}: {
  batches: Batch[];
  students: Student[];
  selectedBatchId: string;
}) {
  const qc = useQueryClient();
  const { institute } = useSettings();
  const today = todayLocalISO();

  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(() => daysAgoISO(CUSTOM_DEFAULT_DAYS));
  const [customTo, setCustomTo] = useState(today);
  const [batchFilter, setBatchFilter] = useState<string>(selectedBatchId || "all");
  const [followedBatchId, setFollowedBatchId] = useState(selectedBatchId);
  if (followedBatchId !== selectedBatchId) {
    setFollowedBatchId(selectedBatchId);
    setBatchFilter(selectedBatchId || "all");
  }
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
  const dateLabel = rangeError
    ? PERIOD_LABEL[period]
    : from === to
      ? fmtDate(from)
      : `${fmtDate(from)} – ${fmtDate(to)}`;

  // Always re-read from the server so the file reflects attendance marked
  // moments ago, not the 30s-stale cached preview.
  const buildFreshReport = async (): Promise<AttendanceReport> => {
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
    return report;
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      if (kind === "copy") {
        const text = buildFreshReport().then(attendanceReportText);
        try {
          await copyToClipboard(text);
        } catch {
          await text; // surfaces the real error if fetching failed
          throw new Error("Your browser blocked copying. Try the PDF instead.");
        }
        toast.success("Copied — paste it in your class WhatsApp group");
        return;
      }

      const report = await buildFreshReport();
      if (kind === "excel") {
        await downloadAttendanceReport(report);
        toast.success("Excel report downloaded");
        return;
      }

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setPdfReport(null);
      setExporting(null);
    }
  };

  const busyIcon = <Loader2 className="h-4 w-4 animate-spin" />;
  const singleDay = from === to;
  const oneBatch = batchFilter !== "all";
  const shownSections = preview?.sections.slice(0, PREVIEW_SECTIONS) ?? [];
  const hiddenSections = (preview?.sections.length ?? 0) - shownSections.length;

  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold leading-tight">
              Absent students report
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Class, date and the names of absent students — ready to share in the class WhatsApp
              group.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <div className="space-y-1.5">
                <Label htmlFor="attendance-report-from">From</Label>
                <Input
                  id="attendance-report-from"
                  type="date"
                  value={from}
                  max={today}
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
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <section aria-label="Report preview" className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-muted/40 px-4 py-2.5">
            <p className="min-w-0 truncate text-sm font-medium">
              {scopeLabel} · {dateLabel}
            </p>
            {preview && !blocker && !loading && (
              <p
                className={`shrink-0 text-sm font-semibold ${preview.totals.absences > 0 ? "text-destructive" : "text-success"}`}
              >
                {preview.totals.absences} absent
              </p>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto" aria-live="polite">
            {loading ? (
              <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
              </p>
            ) : blocker ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">{blocker}</p>
            ) : (
              <ul className="divide-y">
                {shownSections.map((s, i) => (
                  <li key={`${s.sessionDate}-${i}`} className="px-4 py-3">
                    {!(oneBatch && singleDay) && (
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-semibold">
                          {oneBatch ? fmtDate(s.sessionDate) : s.batchName}
                          {!oneBatch && !singleDay && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {fmtDate(s.sessionDate)}
                            </span>
                          )}
                        </p>
                        <span
                          className={`shrink-0 text-xs font-medium ${s.absent.length > 0 ? "text-destructive" : "text-success"}`}
                        >
                          {sectionSummary(s)}
                        </span>
                      </div>
                    )}
                    {s.absent.length > 0 ? (
                      <ol className="gap-x-8 text-sm sm:columns-2">
                        {s.absent.map((a, j) => (
                          <li
                            key={j}
                            className="mb-1 flex min-w-0 break-inside-avoid items-baseline gap-2"
                          >
                            <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                              {j + 1}.
                            </span>
                            <span className="truncate">{a.studentName}</span>
                            {a.rollNo && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                #{a.rollNo}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <UserCheck className="h-3.5 w-3.5" /> Everyone was present.
                      </p>
                    )}
                  </li>
                ))}
                {hiddenSections > 0 && (
                  <li className="px-4 py-3 text-center text-xs text-muted-foreground">
                    + {hiddenSections} more class{hiddenSections === 1 ? "" : "es"} in the
                    downloaded report
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {canShareFiles && (
            <Button
              className="w-full sm:order-last sm:w-auto"
              disabled={!canExport}
              onClick={() => handleExport("share")}
            >
              {exporting === "share" ? busyIcon : <Share2 className="h-4 w-4" />}
              {exporting === "share" ? "Preparing…" : "Share PDF"}
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button variant="outline" disabled={!canExport} onClick={() => handleExport("copy")}>
              {exporting === "copy" ? busyIcon : <Copy className="h-4 w-4" />}
              Copy text
            </Button>
            <Button variant="outline" disabled={!canExport} onClick={() => handleExport("excel")}>
              {exporting === "excel" ? busyIcon : <FileDown className="h-4 w-4" />}
              Excel
            </Button>
            <Button
              variant={canShareFiles ? "outline" : "default"}
              disabled={!canExport}
              onClick={() => handleExport("pdf")}
            >
              {exporting === "pdf" ? busyIcon : <FileText className="h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>
      </CardContent>

      {pdfReport && <AttendanceReportPdf ref={pdfRef} report={pdfReport} />}
    </Card>
  );
}
