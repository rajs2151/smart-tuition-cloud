import { cn } from "@/lib/utils";
import type { Student } from "@/lib/data/types";

/**
 * Present-by-default grid of roll-no chips (PRD §3.1/§3.2). No "present"
 * tap is ever required — every chip starts neutral/green; tapping marks
 * absent (red, struck-through), tapping again un-marks. 44×44px minimum
 * touch target per the PRD's one-handed mobile UX constraint.
 */
export function AttendanceGrid({
  students,
  absentIds,
  onToggle,
  disabled,
}: {
  students: Student[];
  absentIds: Set<string>;
  onToggle: (studentId: string) => void;
  disabled?: boolean;
}) {
  const sorted = [...students].sort((a, b) =>
    a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }),
  );

  if (sorted.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No students in this batch yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {sorted.map((s) => {
        const absent = absentIds.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(s.id)}
            aria-pressed={absent}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-colors",
              absent
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-card hover:bg-accent",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="text-[10px] text-muted-foreground">#{s.rollNo}</span>
            <span className={cn("truncate max-w-full", absent && "line-through")}>{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
