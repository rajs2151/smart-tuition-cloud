import ExcelJS from "exceljs";

import type { Batch } from "@/lib/data/types";
import type { BatchReportPayment } from "@/lib/data/adapter";
import { fmtDate, todayLocalISO } from "@/lib/format";

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

const HEADERS = ["Student Name", "Amount Paid", "Payment Date", "Description"] as const;

/**
 * Generates the "Batch Collection Report" workbook for one batch and one
 * date range, and triggers a browser download.
 *
 * Every row is one payment transaction — no aggregation, matching the
 * Student Payment Timeline and Receipts page (a student with 3 payments
 * in range appears as 3 separate rows). `rows` is expected to already be
 * scoped to the batch and date range server-side (see
 * listPaymentsForBatchInRange in lib/data/adapter.ts) — this function
 * does not filter or re-fetch anything, only renders what it's given.
 */
export async function downloadBatchCollectionReport(
  batch: Batch,
  instituteName: string,
  fromDate: string,
  toDate: string,
  rows: BatchReportPayment[],
): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No payments found for the selected date range.");
  }

  const totalAmount = rows.reduce((sum, p) => sum + p.amount, 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vidyafee";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Collection Report");

  // ---- Header block ----
  const headerLines: [string, string][] = [
    ["Institute", instituteName],
    ["Batch", batch.name],
    ["Date Range", `${fmtDate(fromDate)} – ${fmtDate(toDate)}`],
    ["Generated On", fmtDate(todayLocalISO())],
  ];
  headerLines.forEach(([label, value], i) => {
    const r = sheet.getRow(i + 1);
    r.getCell(1).value = `${label}:`;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = value;
  });

  const tableHeaderRow = headerLines.length + 2; // one blank row, then headers

  // ---- Column header row ----
  const headerRow = sheet.getRow(tableHeaderRow);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: i === 1 ? "center" : "left" };
  });
  headerRow.commit();

  // ---- Data rows — one per payment, already sorted by date ----
  rows.forEach((p, idx) => {
    const r = sheet.getRow(tableHeaderRow + 1 + idx);
    r.getCell(1).value = p.studentName;
    r.getCell(2).value = p.amount;
    r.getCell(2).numFmt = CURRENCY_FMT;
    r.getCell(3).value = fmtDate(p.date);
    r.getCell(4).value = p.note ?? "";
  });

  // ---- Totals footer ----
  const totalsRow = tableHeaderRow + rows.length + 2;
  sheet.getRow(totalsRow).getCell(1).value = "Total Transactions:";
  sheet.getRow(totalsRow).getCell(1).font = { bold: true };
  sheet.getRow(totalsRow).getCell(2).value = rows.length;
  sheet.getRow(totalsRow + 1).getCell(1).value = "Total Amount Collected:";
  sheet.getRow(totalsRow + 1).getCell(1).font = { bold: true };
  sheet.getRow(totalsRow + 1).getCell(2).value = totalAmount;
  sheet.getRow(totalsRow + 1).getCell(2).numFmt = CURRENCY_FMT;
  sheet.getRow(totalsRow + 1).getCell(2).font = { bold: true };

  // ---- Freeze everything above and including the header row ----
  sheet.views = [{ state: "frozen", ySplit: tableHeaderRow }];

  // ---- Auto-fit column widths ----
  HEADERS.forEach((h, i) => {
    const c = i + 1;
    let maxLen = h.length;
    rows.forEach((p) => {
      const v =
        c === 1
          ? p.studentName
          : c === 2
            ? `₹${p.amount.toLocaleString("en-IN")}`
            : c === 3
              ? fmtDate(p.date)
              : (p.note ?? "");
      maxLen = Math.max(maxLen, v.length);
    });
    sheet.getColumn(c).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  // ---- Write & download ----
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `${sanitizeFileNamePart(batch.name)}_Collection_Report_${fromDate}_to_${toDate}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
