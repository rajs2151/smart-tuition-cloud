import ExcelJS from "exceljs";

import type { AttendanceAbsenceRow } from "@/lib/data/adapter";
import type { AttendanceSession, Batch, Student } from "@/lib/data/types";
import { fmtDate, todayLocalISO } from "@/lib/format";

export interface StudentAttendanceRow {
  studentName: string;
  batchName: string;
  takenSessions: number;
  absences: number;
  attendancePct: number; // 0-100
}

/**
 * Student attendance % since admission_date, within the given range
 * (PRD §8/§7 — late admissions only count sessions from their admission
 * date onward). Mirrors how buildBatchFeeReportRows in batch-fee-report.ts
 * derives report rows client-side from already-loaded lists rather than
 * a bespoke aggregation query.
 */
export function buildStudentAttendanceRows(
  students: Student[],
  batches: Batch[],
  sessions: AttendanceSession[],
  absences: AttendanceAbsenceRow[],
  fromDate: string,
  toDate: string,
): StudentAttendanceRow[] {
  const batchName = new Map(batches.map((b) => [b.id, b.name]));
  const takenByBatch = new Map<string, AttendanceSession[]>();
  for (const s of sessions) {
    if (s.status !== "taken") continue;
    const list = takenByBatch.get(s.batchId) ?? [];
    list.push(s);
    takenByBatch.set(s.batchId, list);
  }
  const absencesByStudent = new Map<string, number>();
  for (const a of absences) {
    absencesByStudent.set(a.studentId, (absencesByStudent.get(a.studentId) ?? 0) + 1);
  }

  return students
    .filter((s) => !s.deleted)
    .map((s) => {
      const effectiveFrom = s.admissionDate > fromDate ? s.admissionDate : fromDate;
      const taken = (takenByBatch.get(s.batchId) ?? []).filter(
        (sess) => sess.sessionDate >= effectiveFrom && sess.sessionDate <= toDate,
      ).length;
      const absent = absencesByStudent.get(s.id) ?? 0;
      const pct = taken > 0 ? Math.max(0, Math.round((1 - absent / taken) * 1000) / 10) : 100;
      return {
        studentName: s.name,
        batchName: batchName.get(s.batchId) ?? "—",
        takenSessions: taken,
        absences: absent,
        attendancePct: pct,
      };
    })
    .filter((r) => r.takenSessions > 0)
    .sort((a, b) => a.attendancePct - b.attendancePct);
}

function sanitizeFileNamePart(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

const HEADERS = ["Student Name", "Batch", "Sessions Taken", "Absences", "Attendance %"] as const;
const TITLE_ROW = 1;
const HEADER_ROW = 3;

/** Downloads the "Attendance Report" workbook for a date range, styled to
 *  match the existing Batch Fee Report (bold headers, freeze panes,
 *  conditional highlighting — below 75% attendance flagged red). */
export async function downloadAttendanceReport(
  rows: StudentAttendanceRow[],
  fromDate: string,
  toDate: string,
): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No attendance data in this date range yet.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vidyafee";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Attendance Report");

  const titleCell = sheet.getRow(TITLE_ROW).getCell(1);
  titleCell.value = `Attendance Report — ${fmtDate(fromDate)} to ${fmtDate(toDate)}`;
  titleCell.font = { bold: true, size: 12 };

  const headerRow = sheet.getRow(HEADER_ROW);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: i === 0 || i === 1 ? "left" : "center" };
  });
  headerRow.commit();

  rows.forEach((row, idx) => {
    const r = sheet.getRow(HEADER_ROW + 1 + idx);
    r.getCell(1).value = row.studentName;
    r.getCell(2).value = row.batchName;
    r.getCell(3).value = row.takenSessions;
    r.getCell(4).value = row.absences;
    r.getCell(5).value = row.attendancePct;
    r.getCell(5).numFmt = '0.0"%"';
    if (row.attendancePct < 75) {
      r.getCell(5).fill = RED_FILL;
      r.getCell(5).font = RED_FONT;
    } else {
      r.getCell(5).fill = GREEN_FILL;
      r.getCell(5).font = GREEN_FONT;
    }
  });

  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];
  HEADERS.forEach((h, i) => {
    const c = i + 1;
    let maxLen = h.length;
    rows.forEach((row) => {
      const v = [
        row.studentName,
        row.batchName,
        String(row.takenSessions),
        String(row.absences),
        `${row.attendancePct}%`,
      ][i];
      maxLen = Math.max(maxLen, v.length);
    });
    sheet.getColumn(c).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `Attendance_Report_${sanitizeFileNamePart(fromDate)}_to_${sanitizeFileNamePart(toDate)}_${todayLocalISO()}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
