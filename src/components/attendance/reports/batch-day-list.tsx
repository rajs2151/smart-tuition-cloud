import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { listAttendanceSessions } from "@/lib/data/adapter";
import { fmtDate, todayLocalISO } from "@/lib/format";
import type { AttendanceSession, Batch } from "@/lib/data/types";

// Wide enough to cover this app's realistic history without needing a
// date-range picker in this view — the whole point per the redesign is
// "no session that day = no entry" browsing, not a filterable report.
const GENESIS_DATE = "2000-01-01";

function statusBadge(status: AttendanceSession["status"]) {
  if (status === "holiday") return <Badge variant="secondary">Holiday</Badge>;
  if (status === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
  return (
    <Badge className="bg-success/15 text-success" variant="secondary">
      Taken
    </Badge>
  );
}

export function BatchDayList({
  batch,
  onBack,
  onSelectDay,
}: {
  batch: Batch;
  onBack: () => void;
  onSelectDay: (session: AttendanceSession) => void;
}) {
  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions-batch-history", batch.id],
    queryFn: () => listAttendanceSessions(GENESIS_DATE, todayLocalISO(), batch.id),
  });
  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to batches">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="font-display font-bold leading-tight">{batch.name}</p>
          <p className="text-xs text-muted-foreground">
            {sessions.length} recorded day{sessions.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {sessionsQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No attendance recorded yet for this batch.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const clickable = s.status === "taken";
            return (
              <button
                key={s.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelectDay(s)}
                className={`flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left text-sm transition-colors ${
                  clickable ? "hover:bg-accent" : "cursor-default opacity-70"
                }`}
              >
                <div>
                  <p className="font-medium">{fmtDate(s.sessionDate)}</p>
                  {s.status === "taken" && (
                    <p className="text-xs text-muted-foreground">
                      {s.absentCount} absent of {s.totalStudents}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(s.status)}
                  {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
