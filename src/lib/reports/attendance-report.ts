// ExcelJS (930+ kB) was previously a static import, meaning it loaded
// eagerly as soon as this module's importer (Attendance's Reports tab)
// loaded, even if Excel export was never clicked — confirmed via real
// build output (the exceljs chunk was a direct dependency of the route
// chunk). Now type-only at module scope (zero runtime cost, only used for
// the Fill type annotation below) with the actual value dynamically
// imported inside downloadAttendanceReport, only when it's called.
import type ExcelJS from "exceljs";

import type { AttendanceAbsenceRow } from "@/lib/data/adapter";
import type { AttendanceSession, Batch, Student } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";

export interface AbsentStudent {
  rollNo: string;
  studentName: string;
}

/** One class on one day — the unit a teacher shares to a WhatsApp group. */
export interface ClassDaySection {
  sessionDate: string;
  batchName: string;
  absent: AbsentStudent[];
}

export interface AttendanceReport {
  instituteName: string;
  scopeLabel: string; // "All batches" or the single batch's name
  fromDate: string;
  toDate: string;
  generatedAt: Date;
  sections: ClassDaySection[]; // newest day first, then class name
  totals: {
    sessions: number;
    absences: number;
  };
}

const byRollNo = (a: AbsentStudent, b: AbsentStudent) =>
  a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }) ||
  a.studentName.localeCompare(b.studentName);

/**
 * Absent-students report: for every session where attendance was taken for
 * the in-scope batches within the range, the class name, date and only the
 * names of the students marked absent — no class totals or per-student
 * statistics. Holidays, cancelled lectures and days with no session are
 * omitted (there is no absent list to share).
 *
 * `students` must include soft-deleted students so historical absences
 * still resolve to a name.
 */
export function buildAttendanceReport(input: {
  instituteName: string;
  scopeLabel: string;
  students: Student[];
  batches: Batch[];
  sessions: AttendanceSession[];
  absences: AttendanceAbsenceRow[];
  fromDate: string;
  toDate: string;
}): AttendanceReport {
  const { fromDate, toDate } = input;
  const batchName = new Map(input.batches.map((b) => [b.id, b.name]));
  const studentById = new Map(input.students.map((s) => [s.id, s]));

  const sessions = input.sessions.filter(
    (s) =>
      s.status === "taken" &&
      batchName.has(s.batchId) &&
      s.sessionDate >= fromDate &&
      s.sessionDate <= toDate,
  );

  const absentBySession = new Map<string, AbsentStudent[]>();
  for (const a of input.absences) {
    const student = studentById.get(a.studentId);
    const list = absentBySession.get(a.sessionId) ?? [];
    list.push({
      rollNo: student?.rollNo ?? "",
      studentName: student?.name ?? "Unknown student",
    });
    absentBySession.set(a.sessionId, list);
  }

  const sections: ClassDaySection[] = sessions
    .map((s) => ({
      sessionDate: s.sessionDate,
      batchName: batchName.get(s.batchId)!,
      absent: (absentBySession.get(s.id) ?? []).sort(byRollNo),
    }))
    .sort(
      (a, b) =>
        b.sessionDate.localeCompare(a.sessionDate) || a.batchName.localeCompare(b.batchName),
    );

  return {
    instituteName: input.instituteName,
    scopeLabel: input.scopeLabel,
    fromDate,
    toDate,
    generatedAt: new Date(),
    sections,
    totals: {
      sessions: sections.length,
      absences: sections.reduce((acc, s) => acc + s.absent.length, 0),
    },
  };
}

export function isSingleDay(report: AttendanceReport): boolean {
  return report.fromDate === report.toDate;
}

export function reportDateLabel(report: AttendanceReport): string {
  return isSingleDay(report)
    ? fmtDate(report.fromDate)
    : `${fmtDate(report.fromDate)} to ${fmtDate(report.toDate)}`;
}

export function reportTitle(report: AttendanceReport): string {
  return `Absent Students — ${report.scopeLabel} — ${reportDateLabel(report)}`;
}

/** Human line under a class heading, e.g. "3 absent". */
export function sectionSummary(section: ClassDaySection): string {
  return section.absent.length === 0 ? "No one absent" : `${section.absent.length} absent`;
}

function absentLine(a: AbsentStudent, index: number): string {
  return `${index + 1}. ${a.studentName}${a.rollNo ? ` (Roll ${a.rollNo})` : ""}`;
}

/** Plain-text version for pasting straight into a WhatsApp group
 *  (`*…*` renders bold in WhatsApp). */
export function attendanceReportText(report: AttendanceReport): string {
  const singleDay = isSingleDay(report);
  const lines: string[] = [];
  if (singleDay && report.sections.length === 1) {
    const s = report.sections[0];
    lines.push(
      `*${s.batchName}* — ${fmtDate(s.sessionDate)}`,
      `Absent students: ${s.absent.length}`,
    );
    s.absent.forEach((a, i) => lines.push(absentLine(a, i)));
    return lines.join("\n");
  }
  lines.push(`*Absent Students — ${report.scopeLabel}*`, reportDateLabel(report));
  for (const s of report.sections) {
    const heading = singleDay ? s.batchName : `${s.batchName} — ${fmtDate(s.sessionDate)}`;
    lines.push("", `*${heading}* · ${sectionSummary(s)}`);
    s.absent.forEach((a, i) => lines.push(absentLine(a, i)));
  }
  return lines.join("\n");
}

function sanitizeFileNamePart(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function attendanceReportFileName(report: AttendanceReport, ext: "xlsx" | "pdf"): string {
  const scope = sanitizeFileNamePart(report.scopeLabel) || "All_batches";
  const dates = isSingleDay(report) ? report.fromDate : `${report.fromDate}_to_${report.toDate}`;
  return `Absent_Students_${scope}_${dates}.${ext}`;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};

const HEADERS = ["Date", "Class", "Roll No", "Absent Student", "Absent in Class"] as const;
const TITLE_ROW = 1;
const SUBTITLE_ROW = 2;
const HEADER_ROW = 4;

/** Downloads the absent-students workbook: one row per absent student,
 *  plus one row per class-day with nobody absent so every class where
 *  attendance was taken still appears. */
export async function downloadAttendanceReport(report: AttendanceReport): Promise<void> {
  if (report.sections.length === 0) {
    throw new Error("No attendance was taken in this date range.");
  }

  const rows: string[][] = [];
  for (const s of report.sections) {
    const date = fmtDate(s.sessionDate);
    if (s.absent.length === 0) {
      rows.push([date, s.batchName, "", sectionSummary(s), "0"]);
      continue;
    }
    for (const a of s.absent) {
      rows.push([date, s.batchName, a.rollNo, a.studentName, String(s.absent.length)]);
    }
  }

  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = "Vidyafee";
  workbook.created = report.generatedAt;
  const sheet = workbook.addWorksheet("Absent Students");

  const titleCell = sheet.getRow(TITLE_ROW).getCell(1);
  titleCell.value = reportTitle(report);
  titleCell.font = { bold: true, size: 12 };
  const subtitle = sheet.getRow(SUBTITLE_ROW).getCell(1);
  subtitle.value = [report.instituteName, `Generated ${report.generatedAt.toLocaleString("en-IN")}`]
    .filter(Boolean)
    .join(" · ");
  subtitle.font = { italic: true, color: { argb: "FF6B7280" } };

  const headerRow = sheet.getRow(HEADER_ROW);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  headerRow.commit();

  rows.forEach((values, idx) => {
    const r = sheet.getRow(HEADER_ROW + 1 + idx);
    values.forEach((v, i) => (r.getCell(i + 1).value = v));
  });

  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];
  HEADERS.forEach((h, i) => {
    let maxLen = h.length;
    for (const row of rows) maxLen = Math.max(maxLen, row[i].length + 1);
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveBlob(blob, attendanceReportFileName(report, "xlsx"));
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in Safari/Firefox and
  // some Android WebViews before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
