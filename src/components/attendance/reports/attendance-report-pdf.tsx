import type { Ref } from "react";

import { fmtDate } from "@/lib/format";
import {
  isSingleDay,
  reportDateLabel,
  reportTitle,
  sectionSummary,
  type AttendanceReport,
} from "@/lib/reports/attendance-report";

// A4 at 96 dpi. Every block below has a fixed height so pagination can be
// computed up front: html2canvas captures one page element at a time.
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 40;
const FOOTER_H = 28;
const INTRO_H = 96;
const CLASS_H = 64;
const ROW_H = 28;
const CONTENT_H = PAGE_H - PAD * 2 - FOOTER_H;

// Hard-coded light palette: the export must look the same in dark mode.
const C = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  band: "#f3f4f6",
  red: "#b91c1c",
  green: "#15803d",
};

type Block =
  | { kind: "intro" }
  | { kind: "class"; section: number; continued: boolean }
  | { kind: "row"; section: number; index: number };

const HEIGHT: Record<Block["kind"], number> = { intro: INTRO_H, class: CLASS_H, row: ROW_H };

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

  report.sections.forEach((s, section) => {
    // A class with nobody absent still gets one "No one was absent." line.
    const rows = Math.max(s.absent.length, 1);
    if (used + CLASS_H + ROW_H > CONTENT_H) newPage();
    push({ kind: "class", section, continued: false });
    for (let index = 0; index < rows; index++) {
      if (used + ROW_H > CONTENT_H) {
        newPage();
        push({ kind: "class", section, continued: true });
      }
      push({ kind: "row", section, index });
    }
  });
  return pages;
}

function Intro({ report }: { report: AttendanceReport }) {
  const oneClassOneDay = isSingleDay(report) && report.sections.length === 1;
  return (
    <div style={{ height: INTRO_H }}>
      {report.instituteName && (
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{report.instituteName}</div>
      )}
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
        {oneClassOneDay ? report.sections[0].batchName : "Absent Students"}
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        {oneClassOneDay ? "Absent students · " : `${report.scopeLabel} · `}
        {reportDateLabel(report)}
      </div>
    </div>
  );
}

function ClassHeading({
  report,
  section,
  continued,
}: {
  report: AttendanceReport;
  section: number;
  continued: boolean;
}) {
  const s = report.sections[section];
  return (
    <div style={{ height: CLASS_H, display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
      <div
        style={{
          flex: 1,
          height: 44,
          background: C.band,
          borderRadius: 6,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{s.batchName}</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>
            {fmtDate(s.sessionDate)}
            {continued ? " (contd.)" : ""}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            color: s.absent.length > 0 ? C.red : C.green,
          }}
        >
          {sectionSummary(s)}
        </span>
      </div>
    </div>
  );
}

function AbsentRow({
  report,
  section,
  index,
}: {
  report: AttendanceReport;
  section: number;
  index: number;
}) {
  const s = report.sections[section];
  const a = s.absent[index];
  const base = {
    height: ROW_H,
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    fontSize: 13,
    borderBottom: `1px solid ${C.border}`,
  } as const;
  if (!a) {
    return <div style={{ ...base, color: C.muted }}>No one was absent.</div>;
  }
  return (
    <div style={base}>
      <span style={{ width: 32, color: C.muted }}>{index + 1}.</span>
      {a.rollNo && <span style={{ width: 64, color: C.muted }}>#{a.rollNo}</span>}
      <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{a.studentName}</span>
    </div>
  );
}

function renderBlock(block: Block, report: AttendanceReport, key: number) {
  switch (block.kind) {
    case "intro":
      return <Intro key={key} report={report} />;
    case "class":
      return (
        <ClassHeading
          key={key}
          report={report}
          section={block.section}
          continued={block.continued}
        />
      );
    case "row":
      return <AbsentRow key={key} report={report} section={block.section} index={block.index} />;
  }
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
