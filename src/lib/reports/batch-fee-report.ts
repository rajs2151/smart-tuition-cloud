import ExcelJS from "exceljs";

import type { Batch, Student } from "@/lib/data/types";
import { todayLocalISO } from "@/lib/format";

export interface BatchFeeReportRow {
  studentName: string;
  paidFee: number;
  remainingFee: number;
}

/**
 * Single source of truth for a student's remaining (due) fee.
 *
 * This is the exact same formula used inline on the Fees page
 * (`src/routes/fees.tsx`: `billed = totalFee - discount`,
 * `due = Math.max(0, billed - paidFee)`) — kept here as one function so
 * this report can never drift from what the rest of the app shows for a
 * student's dues.
 */
export function computeRemainingFee(
  student: Pick<Student, "totalFee" | "discount" | "paidFee">,
): number {
  const billed = student.totalFee - student.discount;
  return Math.max(0, billed - student.paidFee);
}

/**
 * Builds the report rows for one batch, sorted by highest remaining
 * fees first (ties broken by name for a stable, predictable order).
 */
export function buildBatchFeeReportRows(students: Student[], batchId: string): BatchFeeReportRow[] {
  return students
    .filter((s) => s.batchId === batchId)
    .map((s) => ({
      studentName: s.name,
      paidFee: s.paidFee,
      remainingFee: computeRemainingFee(s),
    }))
    .sort((a, b) => b.remainingFee - a.remainingFee || a.studentName.localeCompare(b.studentName));
}

function sanitizeFileNamePart(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CURRENCY_FMT = '"₹"#,##0';

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};
// Only the Remaining Fee column is conditionally colored — red while
// something is still owed, green once it's fully paid off. No separate
// Status column/color set: keep it to the two states that actually
// matter for a "who still owes money" report.
const RED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const RED_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF9C0006" } };
const GREEN_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC6EFCE" },
};
const GREEN_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF006100" } };

const HEADERS = ["Student Name", "Paid Fee", "Remaining Fee"] as const;
const TITLE_ROW = 1;
const HEADER_ROW = 3; // one blank row between the title and the table

/**
 * Generates the "Batch Fee Report" workbook for one batch and triggers
 * a browser download. Pass in the full student list already loaded for
 * the Batches page — this function filters it down to the given batch,
 * so no extra fetch/query is made here.
 */
export async function downloadBatchFeeReport(batch: Batch, allStudents: Student[]): Promise<void> {
  const rows = buildBatchFeeReportRows(allStudents, batch.id);

  if (rows.length === 0) {
    throw new Error("No students in this batch yet.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vidyafee";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Fee Report");

  const titleCell = sheet.getRow(TITLE_ROW).getCell(1);
  titleCell.value = `${batch.name} — Fee Report`;
  titleCell.font = { bold: true, size: 12 };

  // ---- Column header row ----
  const headerRow = sheet.getRow(HEADER_ROW);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
  });
  headerRow.commit();

  // ---- Data rows, already sorted highest-remaining-first ----
  rows.forEach((row, idx) => {
    const r = sheet.getRow(HEADER_ROW + 1 + idx);

    r.getCell(1).value = row.studentName;

    r.getCell(2).value = row.paidFee;
    r.getCell(2).numFmt = CURRENCY_FMT;

    r.getCell(3).value = row.remainingFee;
    r.getCell(3).numFmt = CURRENCY_FMT;
    if (row.remainingFee > 0) {
      r.getCell(3).fill = RED_FILL;
      r.getCell(3).font = RED_FONT;
    } else {
      r.getCell(3).fill = GREEN_FILL;
      r.getCell(3).font = GREEN_FONT;
    }
  });

  // ---- Freeze everything above and including the header row ----
  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];

  // ---- Auto-fit column widths ----
  HEADERS.forEach((h, i) => {
    const c = i + 1;
    let maxLen = h.length;
    rows.forEach((row) => {
      const v =
        c === 1
          ? row.studentName
          : `₹${(c === 2 ? row.paidFee : row.remainingFee).toLocaleString("en-IN")}`;
      maxLen = Math.max(maxLen, v.length);
    });
    sheet.getColumn(c).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  // ---- Write & download ----
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `${sanitizeFileNamePart(batch.name)}_Fee_Report_${todayLocalISO()}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
