import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/lib/data/types";

/**
 * Present-by-default grid (Teachmint / coaching-app style):
 * - Tap = toggle absent (red) vs present (neutral)
 * - Search by name / roll
 * - Avatar + consecutive-absence streak badge
 * - 44px minimum touch targets for one-handed mobile use
 */
export function AttendanceGrid({
  students,
  absentIds,
  onToggle,
  disabled,
  consecutiveAbsences,
}: {
  students: Student[];
  absentIds: Set<string>;
  onToggle: (studentId: string) => void;
  disabled?: boolean;
  /** Prior consecutive absences ending before today's session (excludes current draft). */
  consecutiveAbsences?: Map<string, number>;
}) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...students]
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          (s.phone ?? "").includes(q)
        );
      })
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
  }, [students, search]);

  const presentCount = students.length - absentIds.size;
  const absentCount = absentIds.size;

  if (students.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No students in this batch yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or roll…"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="bg-success/15 text-success">
            Present {presentCount}
          </Badge>
          <Badge variant="secondary" className="bg-destructive/10 text-destructive">
            Absent {absentCount}
          </Badge>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No students match “{search}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sorted.map((s) => {
            const absent = absentIds.has(s.id);
            const streak = consecutiveAbsences?.get(s.id) ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(s.id)}
                aria-pressed={absent}
                aria-label={`${s.name}, ${absent ? "absent" : "present"}${streak >= 2 ? `, ${streak} prior consecutive absences` : ""}`}
                className={cn(
                  "relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition-colors",
                  absent
                    ? "border-destructive/40 bg-destructive/10 text-destructive shadow-sm"
                    : "border-border bg-card hover:bg-accent",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {streak >= 2 && (
                  <span className="absolute right-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                    {streak}d
                  </span>
                )}
                <Avatar className="h-8 w-8">
                  {s.photo ? <AvatarImage src={s.photo} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground">#{s.rollNo}</span>
                <span className={cn("max-w-full truncate font-medium", absent && "line-through")}>
                  {s.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    absent ? "text-destructive" : "text-success",
                  )}
                >
                  {absent ? "Absent" : "Present"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
