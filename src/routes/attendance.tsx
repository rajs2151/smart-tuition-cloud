import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, CalendarOff, Ban, MessageCircle, Lock, Loader2 } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { RouteErrorComponent } from "@/components/route-error";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { NotifyAbsenteesDialog } from "@/components/attendance/notify-absentees-dialog";
import { NotifyTab } from "@/components/attendance/notify-tab";
import { BatchesOverview } from "@/components/attendance/reports/batches-overview";
import { BatchDayList } from "@/components/attendance/reports/batch-day-list";
import { DayNotifyList } from "@/components/attendance/reports/day-notify-list";

import {
  listBatches,
  listStudents,
  loadAttendanceForBatch,
  markAttendanceStatus,
  saveAttendance,
} from "@/lib/data/adapter";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { useSettings } from "@/lib/settings/store";
import { todayLocalISO } from "@/lib/format";
import type { AttendanceSession, Batch, Student } from "@/lib/data/types";

const pageQuery = {
  queryKey: ["attendance-page"] as const,
  queryFn: async () => {
    const [batches, students] = await Promise.all([
      listBatches(),
      listStudents(true),
    ]);
    return { batches, students };
  },
};

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Vidyafee" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery),
  component: AttendancePage,
  errorComponent: RouteErrorComponent,
});

function AttendancePage() {
  const { data } = useSuspenseQuery(pageQuery);
  const { role } = useSession();
  const { attendance: attendanceSettings } = useSettings();
  const allowed = can(role, "attendance");
  const activeBatches = data.batches.filter((b) => !b.deleted && b.active);

  const [batchId, setBatchId] = useState<string>(activeBatches[0]?.id ?? "");
  useEffect(() => {
    if (!batchId && activeBatches.length > 0) setBatchId(activeBatches[0].id);
  }, [activeBatches, batchId]);

  const batch = data.batches.find((b) => b.id === batchId);

  if (!allowed) {
    return (
      <>
        <AppHeader title="Attendance" />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              Your role doesn&apos;t have access to Attendance.
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Attendance"
        subtitle={`${activeBatches.length} active batches`}
        actions={
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {activeBatches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {activeBatches.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              No active batches yet. Create a batch first.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="mark" className="space-y-4">
            <TabsList>
              <TabsTrigger value="mark">Take Attendance</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="notify">Notify</TabsTrigger>
            </TabsList>
            <TabsContent value="mark">
              {batch && <MarkAttendanceTab batch={batch} allStudents={data.students} />}
            </TabsContent>
            <TabsContent value="reports">
              <AttendanceReportsTab batches={activeBatches} students={data.students} />
            </TabsContent>
            <TabsContent value="notify">
              <NotifyTab
                batches={activeBatches}
                students={data.students}
                attendanceLanguage={attendanceSettings.language}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </>
  );
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function MarkAttendanceTab({ batch, allStudents }: { batch: Batch; allStudents: Student[] }) {
  const qc = useQueryClient();
  const { role } = useSession();
  const { attendance: attendanceSettings } = useSettings();
  const isPrivileged = role === "owner" || role === "admin";

  const [sessionDate, setSessionDate] = useState(todayLocalISO());
  const students = allStudents.filter(
    (s) => s.batchId === batch.id && !s.deleted && s.status === "active",
  );

  const attendanceQuery = useQuery({
    queryKey: ["attendance", batch.id, sessionDate],
    queryFn: () => loadAttendanceForBatch(batch.id, sessionDate),
  });
  const attendanceKey = ["attendance", batch.id, sessionDate] as const;

  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const localDirty = useRef(false);
  useEffect(() => {
    localDirty.current = false;
  }, [sessionDate, batch.id]);
  useEffect(() => {
    if (!localDirty.current && attendanceQuery.data) {
      setAbsentIds(new Set(attendanceQuery.data.absentStudentIds));
    }
  }, [attendanceQuery.data]);

  const persist = useMutation({
    mutationFn: (ids: string[]) => saveAttendance(batch, sessionDate, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: attendanceKey });
      const previous = qc.getQueryData<typeof attendanceQuery.data>(attendanceKey);
      qc.setQueryData(attendanceKey, (old: typeof attendanceQuery.data) =>
        old ? { ...old, absentStudentIds: ids } : old,
      );
      return { previous };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(attendanceKey, ctx.previous);
      setAbsentIds(new Set(ctx?.previous?.absentStudentIds ?? []));
      localDirty.current = false;
      toast.error(err instanceof Error ? err.message : "Could not save attendance.");
    },
    onSuccess: () => {
      localDirty.current = false;
    },
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [lastAbsentStudents, setLastAbsentStudents] = useState<typeof students>([]);

  const existingSession = attendanceQuery.data?.session ?? null;
  const locked =
    !!existingSession &&
    existingSession.status === "taken" &&
    !isPrivileged &&
    (existingSession.sessionDate !== todayLocalISO() ||
      (!!attendanceSettings.lockTime && nowHHMM() > attendanceSettings.lockTime));

  const toggle = (studentId: string) => {
    if (locked) return;
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      const ids = [...next];
      localDirty.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => persist.mutate(ids), 400);
      return next;
    });
  };

  const save = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaving(true);
    try {
      const ids = [...absentIds];
      await persist.mutateAsync(ids);
      const absentStudents = students.filter((s) => absentIds.has(s.id));
      setLastAbsentStudents(absentStudents);
      if (absentStudents.length > 0) {
        toast.success(`Attendance saved · ${absentStudents.length} absent`, {
          action: {
            label: "Send WhatsApp",
            onClick: () => setNotifyOpen(true),
          },
        });
      } else {
        toast.success("Attendance saved · everyone present");
      }
    } catch {
      /* persist.onError already toasted */
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: "holiday" | "cancelled") => {
    setSaving(true);
    try {
      await markAttendanceStatus(batch, sessionDate, status);
      await qc.invalidateQueries({ queryKey: ["attendance", batch.id, sessionDate] });
      toast.success(`Marked as ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update attendance status.");
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = () => {
    if (!existingSession) return <Badge variant="outline">Not yet taken</Badge>;
    if (existingSession.status === "holiday") return <Badge variant="secondary">Holiday</Badge>;
    if (existingSession.status === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
    return (
      <Badge className="bg-success/15 text-success" variant="secondary">
        Taken
      </Badge>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-display font-bold leading-tight">{batch.name}</p>
              <p className="text-xs text-muted-foreground">
                {students.length} students · {absentIds.size} marked absent
              </p>
            </div>
            {statusBadge()}
            {locked && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Locked — ask an owner/admin to edit
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={sessionDate}
              max={todayLocalISO()}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full sm:w-40"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setStatus("holiday")}
              className="flex-1 sm:flex-none"
            >
              <CalendarOff className="h-3.5 w-3.5" /> Holiday
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setStatus("cancelled")}
              className="flex-1 sm:flex-none"
            >
              <Ban className="h-3.5 w-3.5" /> Cancel lecture
            </Button>
          </div>
        </CardContent>
      </Card>

      {existingSession && existingSession.status !== "taken" ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            {existingSession.status === "holiday"
              ? "Marked as a holiday."
              : "Marked as a cancelled lecture."}{" "}
            No attendance recorded for this session.
          </CardContent>
        </Card>
      ) : attendanceQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading attendance…
          </CardContent>
        </Card>
      ) : attendanceQuery.isError ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-sm text-destructive">
              {attendanceQuery.error instanceof Error
                ? attendanceQuery.error.message
                : "Could not load attendance for this date."}
            </p>
            <Button variant="outline" onClick={() => void attendanceQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className={`p-4 ${attendanceQuery.isFetching ? "opacity-70 transition-opacity" : ""}`}>
            <AttendanceGrid
              students={students}
              absentIds={absentIds}
              onToggle={toggle}
              disabled={locked}
            />
          </CardContent>
        </Card>
      )}

      {(!existingSession || existingSession.status === "taken") && (
        <div className="sticky bottom-4 z-10 flex justify-center px-4 sm:px-0">
          <Card className="w-full shadow-lg sm:w-auto">
            <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={saving || locked}
                onClick={save}
              >
                <CalendarCheck className="h-4 w-4" />
                {saving ? "Saving…" : `Save Attendance (${absentIds.size} absent)`}
              </Button>
              {lastAbsentStudents.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setNotifyOpen(true)}
                >
                  <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  Notify {lastAbsentStudents.length} parent
                  {lastAbsentStudents.length > 1 ? "s" : ""}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <NotifyAbsenteesDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        batch={batch}
        sessionDate={sessionDate}
        absentStudents={lastAbsentStudents}
        attendanceLanguage={attendanceSettings.language}
      />
    </div>
  );
}

function AttendanceReportsTab({ batches, students }: { batches: Batch[]; students: Student[] }) {
  const { attendance: attendanceSettings } = useSettings();
  const [view, setView] = useState<
    | { level: "batches" }
    | { level: "days"; batch: Batch }
    | { level: "day"; batch: Batch; session: AttendanceSession }
  >({ level: "batches" });

  if (view.level === "days") {
    return (
      <BatchDayList
        batch={view.batch}
        onBack={() => setView({ level: "batches" })}
        onSelectDay={(session) => setView({ level: "day", batch: view.batch, session })}
      />
    );
  }

  if (view.level === "day") {
    return (
      <DayNotifyList
        batch={view.batch}
        session={view.session}
        students={students}
        attendanceLanguage={attendanceSettings.language}
        onBack={() => setView({ level: "days", batch: view.batch })}
      />
    );
  }

  return (
    <BatchesOverview
      batches={batches}
      students={students}
      onSelectBatch={(batch) => setView({ level: "days", batch })}
    />
  );
}
