// ExcelJS (930+ kB) was previously a static import, meaning it loaded
// eagerly as soon as this module's importer (Attendance's Reports tab)
// loaded, even if Excel export was never clicked — confirmed via real
// build output (the exceljs chunk was a direct dependency of the route
// chunk). Now type-only at module scope (zero runtime cost, only used for
// the Fill/Font type annotations below) with the actual value dynamically
// imported inside downloadAttendanceReport, only when it's called.
import type ExcelJS from "exceljs";

import type { AttendanceAbsenceRow } from "@/lib/data/adapter";
import type { AttendanceSession, Batch, Student } from "@/lib/data/types";
import { fmtDate } from "@/lib/format";

/** Below this, a student's attendance is flagged red in every export. */
export const LOW_ATTENDANCE_PCT = 75;

export interface StudentAttendanceRow {
  studentId: string;
  rollNo: string;
  studentName: string;
  batchName: string;
  status: Student["status"];
  takenSessions: number;
  present: number;
  absences: number;
  attendancePct: number; // 0-100
}

export interface BatchAttendanceRow {
  batchName: string;
  students: number;
  takenSessions: number;
  holidays: number;
  cancelled: number;
  absences: number;
  attendancePct: number | null; // null = no taken sessions in range
}

export interface AbsenceLogRow {
  sessionDate: string;
  batchName: string;
  rollNo: string;
  studentName: string;
  notified: boolean;
}

export interface AttendanceReport {
  instituteName: string;
  scopeLabel: string; // "All batches" or the single batch's name
  fromDate: string;
  toDate: string;
  generatedAt: Date;
  students: StudentAttendanceRow[];
  batches: BatchAttendanceRow[];
  absenceLog: AbsenceLogRow[];
  totals: {
    takenSessions: number;
    absences: number;
    lowAttendanceStudents: number;
    attendancePct: number | null;
  };
}

const pct = (present: number, total: number) =>
  total > 0 ? Math.max(0, Math.round((present / total) * 1000) / 10) : null;

const byRollNo = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Builds every table the Excel/PDF exports need from already-fetched
 * sessions + absences, client-side, the same way buildBatchFeeReportRows
 * derives rows from loaded lists rather than a bespoke aggregation query.
 *
 * `batches` is the report scope: only sessions, absences and students of
 * these batches are counted. A student's percentage only counts sessions
 * from their admission date onward (PRD §8/§7 — late admissions), and only
 * absences from those same sessions, so absences can never exceed sessions.
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
  const { students, batches, fromDate, toDate } = input;
  const batchIds = new Set(batches.map((b) => b.id));
  const batchName = new Map(batches.map((b) => [b.id, b.name]));

  const sessions = input.sessions.filter(
    (s) => batchIds.has(s.batchId) && s.sessionDate >= fromDate && s.sessionDate <= toDate,
  );
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const absences = input.absences.filter((a) => sessionById.has(a.sessionId));

  const takenByBatch = new Map<string, AttendanceSession[]>();
  for (const s of sessions) {
    if (s.status !== "taken") continue;
    const list = takenByBatch.get(s.batchId) ?? [];
    list.push(s);
    takenByBatch.set(s.batchId, list);
  }

  const absentSessionsByStudent = new Map<string, Set<string>>();
  for (const a of absences) {
    const set = absentSessionsByStudent.get(a.studentId) ?? new Set<string>();
    set.add(a.sessionId);
    absentSessionsByStudent.set(a.studentId, set);
  }

  const studentRows: StudentAttendanceRow[] = students
    .filter((s) => !s.deleted && batchIds.has(s.batchId))
    .map((s) => {
      const admission = (s.admissionDate ?? "").slice(0, 10);
      const effectiveFrom = admission > fromDate ? admission : fromDate;
      const counted = (takenByBatch.get(s.batchId) ?? []).filter(
        (sess) => sess.sessionDate >= effectiveFrom,
      );
      const absentIn = absentSessionsByStudent.get(s.id);
      const absent = absentIn ? counted.filter((sess) => absentIn.has(sess.id)).length : 0;
      const taken = counted.length;
      return {
        studentId: s.id,
        rollNo: s.rollNo ?? "",
        studentName: s.name,
        batchName: batchName.get(s.batchId) ?? "—",
        status: s.status,
        takenSessions: taken,
        present: taken - absent,
        absences: absent,
        attendancePct: pct(taken - absent, taken) ?? 100,
      };
    })
    .filter((r) => r.takenSessions > 0)
    .sort((a, b) => a.batchName.localeCompare(b.batchName) || byRollNo(a.rollNo, b.rollNo));

  const studentsPerBatch = new Map<string, number>();
  for (const r of studentRows) {
    studentsPerBatch.set(r.batchName, (studentsPerBatch.get(r.batchName) ?? 0) + 1);
  }

  const batchRows: BatchAttendanceRow[] = batches
    .map((b) => {
      const own = sessions.filter((s) => s.batchId === b.id);
      const taken = own.filter((s) => s.status === "taken");
      const total = taken.reduce((acc, s) => acc + s.totalStudents, 0);
      const absent = taken.reduce((acc, s) => acc + s.absentCount, 0);
      return {
        batchName: b.name,
        students: studentsPerBatch.get(b.name) ?? 0,
        takenSessions: taken.length,
        holidays: own.filter((s) => s.status === "holiday").length,
        cancelled: own.filter((s) => s.status === "cancelled").length,
        absences: absent,
        attendancePct: pct(total - absent, total),
      };
    })
    .sort((a, b) => a.batchName.localeCompare(b.batchName));

  const studentById = new Map(students.map((s) => [s.id, s]));
  const absenceLog: AbsenceLogRow[] = absences
    .map((a) => {
      const session = sessionById.get(a.sessionId)!;
      const student = studentById.get(a.studentId);
      return {
        sessionDate: session.sessionDate,
        batchName: batchName.get(session.batchId) ?? "—",
        rollNo: student?.rollNo ?? "",
        studentName: student?.name ?? "Unknown student",
        notified: !!a.notifiedAt,
      };
    })
    .sort(
      (a, b) =>
        b.sessionDate.localeCompare(a.sessionDate) ||
        a.batchName.localeCompare(b.batchName) ||
        byRollNo(a.rollNo, b.rollNo),
    );

  const allTaken = sessions.filter((s) => s.status === "taken");
  const grandTotal = allTaken.reduce((acc, s) => acc + s.totalStudents, 0);
  const grandAbsent = allTaken.reduce((acc, s) => acc + s.absentCount, 0);

  return {
    instituteName: input.instituteName,
    scopeLabel: input.scopeLabel,
    fromDate,
    toDate,
    generatedAt: new Date(),
    students: studentRows,
    batches: batchRows,
    absenceLog,
    totals: {
      takenSessions: allTaken.length,
      absences: grandAbsent,
      lowAttendanceStudents: studentRows.filter((r) => r.attendancePct < LOW_ATTENDANCE_PCT).length,
      attendancePct: pct(grandTotal - grandAbsent, grandTotal),
    },
  };
}

function sanitizeFileNamePart(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function attendanceReportFileName(report: AttendanceReport, ext: "xlsx" | "pdf"): string {
  const scope = sanitizeFileNamePart(report.scopeLabel) || "All_batches";
  return `Attendance_Report_${scope}_${report.fromDate}_to_${report.toDate}.${ext}`;
}

export function reportTitle(report: AttendanceReport): string {
  return `Attendance Report — ${report.scopeLabel} — ${fmtDate(report.fromDate)} to ${fmtDate(report.toDate)}`;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};
const RED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const RED_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF9C0006" } };
const GREEN_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC6EFCE" },
};
const GREEN_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF006100" } };

const TITLE_ROW = 1;
const SUBTITLE_ROW = 2;
const HEADER_ROW = 4;

type Cell = string | number | null;

interface SheetSpec {
  name: string;
  headers: string[];
  leftAligned: number; // first N columns are text, the rest centered
  rows: Cell[][];
  pctColumn?: number; // 1-based column holding an attendance %
}

function addSheet(workbook: ExcelJS.Workbook, report: AttendanceReport, spec: SheetSpec) {
  const sheet = workbook.addWorksheet(spec.name);

  const titleCell = sheet.getRow(TITLE_ROW).getCell(1);
  titleCell.value = reportTitle(report);
  titleCell.font = { bold: true, size: 12 };
  const subtitle = sheet.getRow(SUBTITLE_ROW).getCell(1);
  subtitle.value = [report.instituteName, `Generated ${report.generatedAt.toLocaleString("en-IN")}`]
    .filter(Boolean)
    .join(" · ");
  subtitle.font = { italic: true, color: { argb: "FF6B7280" } };

  const headerRow = sheet.getRow(HEADER_ROW);
  spec.headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: i < spec.leftAligned ? "left" : "center" };
  });
  headerRow.commit();

  spec.rows.forEach((values, idx) => {
    const r = sheet.getRow(HEADER_ROW + 1 + idx);
    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v ?? "—";
      if (i >= spec.leftAligned) cell.alignment = { horizontal: "center" };
    });
    if (spec.pctColumn) {
      const cell = r.getCell(spec.pctColumn);
      const v = values[spec.pctColumn - 1];
      if (typeof v === "number") {
        cell.numFmt = '0.0"%"';
        const low = v < LOW_ATTENDANCE_PCT;
        cell.fill = low ? RED_FILL : GREEN_FILL;
        cell.font = low ? RED_FONT : GREEN_FONT;
      }
    }
  });

  if (spec.rows.length === 0) {
    sheet.getRow(HEADER_ROW + 1).getCell(1).value = "No entries in this date range.";
  }

  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];
  spec.headers.forEach((h, i) => {
    let maxLen = h.length;
    for (const row of spec.rows) maxLen = Math.max(maxLen, String(row[i] ?? "—").length + 1);
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });
}

const STATUS_LABEL: Record<Student["status"], string> = {
  active: "Active",
  dropped: "Dropped",
  completed: "Completed",
};

/** Downloads the Attendance Report workbook: a student-wise sheet, a
 *  batch summary and a dated absence log, styled to match the existing
 *  Batch Fee Report (bold headers, freeze panes, below-75% flagged red). */
export async function downloadAttendanceReport(report: AttendanceReport): Promise<void> {
  if (report.students.length === 0 && report.totals.takenSessions === 0) {
    throw new Error("No attendance was taken in this date range.");
  }

  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = "Vidyafee";
  workbook.created = report.generatedAt;

  addSheet(workbook, report, {
    name: "Students",
    headers: [
      "Roll No",
      "Student Name",
      "Batch",
      "Status",
      "Sessions",
      "Present",
      "Absent",
      "Attendance %",
    ],
    leftAligned: 4,
    pctColumn: 8,
    rows: report.students.map((r) => [
      r.rollNo,
      r.studentName,
      r.batchName,
      STATUS_LABEL[r.status] ?? r.status,
      r.takenSessions,
      r.present,
      r.absences,
      r.attendancePct,
    ]),
  });

  addSheet(workbook, report, {
    name: "Batch Summary",
    headers: [
      "Batch",
      "Students",
      "Sessions Taken",
      "Holidays",
      "Cancelled",
      "Total Absences",
      "Attendance %",
    ],
    leftAligned: 1,
    pctColumn: 7,
    rows: report.batches.map((b) => [
      b.batchName,
      b.students,
      b.takenSessions,
      b.holidays,
      b.cancelled,
      b.absences,
      b.attendancePct,
    ]),
  });

  addSheet(workbook, report, {
    name: "Absence Log",
    headers: ["Date", "Batch", "Roll No", "Student Name", "Parent Notified"],
    leftAligned: 4,
    rows: report.absenceLog.map((a) => [
      fmtDate(a.sessionDate),
      a.batchName,
      a.rollNo,
      a.studentName,
      a.notified ? "Yes" : "No",
    ]),
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
