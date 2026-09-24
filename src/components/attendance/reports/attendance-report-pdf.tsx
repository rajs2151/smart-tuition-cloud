import type { CSSProperties, ReactNode, Ref } from "react";

import { fmtDate } from "@/lib/format";
import {
  LOW_ATTENDANCE_PCT,
  reportTitle,
  type AttendanceReport,
} from "@/lib/reports/attendance-report";

// A4 at 96 dpi. Every block below has a fixed height so pagination can be
// computed up front: html2canvas captures one page element at a time.
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 40;
const FOOTER_H = 28;
const INTRO_H = 140;
const SECTION_H = 40;
const TH_H = 26;
const ROW_H = 24;
const CONTENT_H = PAGE_H - PAD * 2 - FOOTER_H;

// Hard-coded light palette: the export must look the same in dark mode.
const C = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  headBg: "#1f2937",
  zebra: "#f9fafb",
  red: "#9c0006",
  redBg: "#ffc7ce",
  green: "#006100",
  greenBg: "#c6efce",
};

type TableId = "batches" | "students";

type Block =
  | { kind: "intro" }
  | { kind: "section"; table: TableId }
  | { kind: "thead"; table: TableId }
  | { kind: "row"; table: TableId; index: number };

const HEIGHT: Record<Block["kind"], number> = {
  intro: INTRO_H,
  section: SECTION_H,
  thead: TH_H,
  row: ROW_H,
};

function paginate(report: AttendanceReport): Block[][] {
  const pages: Block[][] = [[{ kind: "intro" }]];
  let used = INTRO_H;
  const newPage = () => {
    pages.push([]);
    used = 0;
  };
  const push = (b: Block) => {
    pages[pages.length - 1].push(b);
    used += HEIGHT[b.kind];
  };

  const tables: [TableId, number][] = [
    ["batches", report.batches.length],
    ["students", report.students.length],
  ];
  for (const [table, count] of tables) {
    if (used + SECTION_H + TH_H + ROW_H > CONTENT_H) newPage();
    push({ kind: "section", table });
    push({ kind: "thead", table });
    for (let index = 0; index < Math.max(count, 1); index++) {
      if (used + ROW_H > CONTENT_H) {
        newPage();
        push({ kind: "thead", table });
      }
      push({ kind: "row", table, index });
    }
  }
  return pages;
}

const COLUMNS: Record<TableId, { label: string; width: string; align?: "left" }[]> = {
  batches: [
    { label: "Batch", width: "1fr", align: "left" },
    { label: "Students", width: "70px" },
    { label: "Sessions", width: "76px" },
    { label: "Holidays", width: "70px" },
    { label: "Cancelled", width: "76px" },
    { label: "Absences", width: "76px" },
    { label: "Attendance", width: "84px" },
  ],
  students: [
    { label: "Roll No", width: "70px", align: "left" },
    { label: "Student", width: "1fr", align: "left" },
    { label: "Batch", width: "150px", align: "left" },
    { label: "Sessions", width: "66px" },
    { label: "Present", width: "62px" },
    { label: "Absent", width: "58px" },
    { label: "Attendance", width: "84px" },
  ],
};

const SECTION_TITLE: Record<TableId, string> = {
  batches: "Batch summary",
  students: "Student-wise attendance",
};

const cellBase: CSSProperties = {
  padding: "0 8px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  display: "flex",
  alignItems: "center",
};

function Row({
  table,
  height,
  style,
  children,
}: {
  table: TableId;
  height: number;
  style?: CSSProperties;
  children: ReactNode[];
}) {
  const cols = COLUMNS[table];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols.map((c) => c.width).join(" "),
        height,
        borderBottom: `1px solid ${C.border}`,
        fontSize: 11,
        ...style,
      }}
    >
      {children.map((child, i) => (
        <div
          key={i}
          style={{
            ...cellBase,
            justifyContent: cols[i].align === "left" ? "flex-start" : "center",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: C.muted }}>—</span>;
  const low = value < LOW_ATTENDANCE_PCT;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 600,
        color: low ? C.red : C.green,
        background: low ? C.redBg : C.greenBg,
      }}
    >
      {value.toFixed(1)}%
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function renderBlock(block: Block, report: AttendanceReport, key: number) {
  switch (block.kind) {
    case "intro":
      return (
        <div key={key} style={{ height: INTRO_H }}>
          {report.instituteName && (
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
              {report.instituteName}
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Attendance Report</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            {report.scopeLabel} · {fmtDate(report.fromDate)} to {fmtDate(report.toDate)} · Generated{" "}
            {report.generatedAt.toLocaleString("en-IN")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Stat label="Sessions taken" value={String(report.totals.takenSessions)} />
            <Stat
              label="Overall attendance"
              value={
                report.totals.attendancePct === null
                  ? "—"
                  : `${report.totals.attendancePct.toFixed(1)}%`
              }
            />
            <Stat label="Total absences" value={String(report.totals.absences)} />
            <Stat
              label={`Students below ${LOW_ATTENDANCE_PCT}%`}
              value={String(report.totals.lowAttendanceStudents)}
            />
          </div>
        </div>
      );
    case "section":
      return (
        <div
          key={key}
          style={{
            height: SECTION_H,
            display: "flex",
            alignItems: "flex-end",
            paddingBottom: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {SECTION_TITLE[block.table]}
        </div>
      );
    case "thead":
      return (
        <Row
          key={key}
          table={block.table}
          height={TH_H}
          style={{ background: C.headBg, color: "#ffffff", fontWeight: 600, borderBottom: 0 }}
        >
          {COLUMNS[block.table].map((c) => c.label)}
        </Row>
      );
    case "row": {
      const zebra = block.index % 2 === 1 ? { background: C.zebra } : undefined;
      if (block.table === "batches") {
        const b = report.batches[block.index];
        if (!b) return <EmptyRow key={key} table="batches" />;
        return (
          <Row key={key} table="batches" height={ROW_H} style={zebra}>
            {[
              b.batchName,
              b.students,
              b.takenSessions,
              b.holidays,
              b.cancelled,
              b.absences,
              <PctBadge key="pct" value={b.attendancePct} />,
            ]}
          </Row>
        );
      }
      const s = report.students[block.index];
      if (!s) return <EmptyRow key={key} table="students" />;
      return (
        <Row key={key} table="students" height={ROW_H} style={zebra}>
          {[
            s.rollNo || "—",
            s.status === "active" ? s.studentName : `${s.studentName} (${s.status})`,
            s.batchName,
            s.takenSessions,
            s.present,
            s.absences,
            <PctBadge key="pct" value={s.attendancePct} />,
          ]}
        </Row>
      );
    }
  }
}

function EmptyRow({ table }: { table: TableId }) {
  return (
    <div
      style={{
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        fontSize: 11,
        color: C.muted,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {table === "batches" ? "No batches in this report." : "No attendance taken in this range."}
    </div>
  );
}

/** Off-screen, print-styled rendering of an AttendanceReport, one
 *  `[data-pdf-page]` element per A4 page, consumed by exportPagesToPdf. */
export function AttendanceReportPdf({
  report,
  ref,
}: {
  report: AttendanceReport;
  ref: Ref<HTMLDivElement>;
}) {
  const pages = paginate(report);
  return (
    <div
      ref={ref}
      aria-hidden
      style={{ position: "fixed", left: -10_000, top: 0, pointerEvents: "none" }}
    >
      {pages.map((blocks, p) => (
        <div
          key={p}
          data-pdf-page
          style={{
            width: PAGE_W,
            height: PAGE_H,
            padding: PAD,
            boxSizing: "border-box",
            background: "#ffffff",
            color: C.text,
            fontFamily: "var(--font-sans)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: CONTENT_H, overflow: "hidden" }}>
            {blocks.map((b, i) => renderBlock(b, report, i))}
          </div>
          <div
            style={{
              height: FOOTER_H,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              fontSize: 9,
              color: C.muted,
            }}
          >
            <span>{reportTitle(report)}</span>
            <span>
              Page {p + 1} of {pages.length}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
