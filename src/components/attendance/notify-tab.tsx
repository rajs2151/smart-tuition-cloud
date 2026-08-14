import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MessageCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  listAttendanceSessions,
  listTodayAbsencesForInstitute,
  markAbsenceNotified,
} from "@/lib/data/adapter";
import { logComm, useMessaging } from "@/lib/messaging/store";
import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";
import { fmtDate, todayLocalISO } from "@/lib/format";
import type { AttendanceLanguage, Batch, Student } from "@/lib/data/types";

/**
 * Top-level "Notify" tab — a single flat table of every absent student
 * across every batch, TODAY only, one Send action per row. Distinct from
 * DayNotifyList (Reports → batch → day), which is per-batch and works
 * for any historical day; this is the fast, batch-agnostic "who do I
 * still need to message today" view, matching the flat-table spec
 * (Name, Batch, Send) rather than a batch-first drill-down.
 */
export function NotifyTab({
  batches,
  students,
  attendanceLanguage,
}: {
  batches: Batch[];
  students: Student[];
  attendanceLanguage: AttendanceLanguage;
}) {
  const qc = useQueryClient();
  const { templates } = useMessaging();
  const today = todayLocalISO();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const absencesQuery = useQuery({
    queryKey: ["attendance-today-absences", today],
    queryFn: () => listTodayAbsencesForInstitute(today),
  });
  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions-today", today],
    queryFn: () => listAttendanceSessions(today, today),
  });

  const absences = useMemo(() => absencesQuery.data ?? [], [absencesQuery.data]);
  const todaysSessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const skippedCount = todaysSessions.filter((s) => s.status !== "taken").length;

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const batchById = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);

  const attendanceTemplates = templates.filter((t) => t.category === "attendance");
  const tpl =
    attendanceTemplates.find((t) => t.language === attendanceLanguage) ?? attendanceTemplates[0];

  const rows = useMemo(() => {
    return absences
      .map((a) => ({
        absence: a,
        student: studentById.get(a.studentId),
        batch: batchById.get(a.batchId),
      }))
      .filter(
        (r): r is { absence: (typeof absences)[number]; student: Student; batch: Batch } =>
          !!r.student && !!r.batch,
      )
      .sort((a, b) => {
        const aSent = a.absence.notifiedAt ? 1 : 0;
        const bSent = b.absence.notifiedAt ? 1 : 0;
        if (aSent !== bSent) return aSent - bSent;
        if (a.batch.name !== b.batch.name) return a.batch.name.localeCompare(b.batch.name);
        return a.student.rollNo.localeCompare(b.student.rollNo, undefined, { numeric: true });
      });
  }, [absences, studentById, batchById]);

  const send = async (row: (typeof rows)[number]) => {
    if (!tpl) {
      toast.error("No attendance message template found. Add one in Settings → Message Templates.");
      return;
    }
    const mobile = pickMobile(row.student);
    if (!mobile) {
      toast.error(`No number on file for ${row.student.name}.`);
      return;
    }
    const message = renderMessage(
      tpl,
      buildContext({
        student: row.student,
        batch: row.batch,
        pending: 0,
        extras: { AttendanceDate: fmtDate(today) },
      }),
    );
    setSendingId(row.absence.id);
    try {
      openWhatsApp(mobile, message);
      await logComm({
        studentId: row.student.id,
        studentName: row.student.name,
        mobile,
        templateId: tpl.id,
        templateName: tpl.name,
        category: "attendance",
        message,
        sentBy: "attendance",
      });
      await markAbsenceNotified(row.absence.id);
      await qc.invalidateQueries({ queryKey: ["attendance-today-absences", today] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark this as sent.");
    } finally {
      setSendingId(null);
    }
  };

  const sentCount = rows.filter((r) => r.absence.notifiedAt).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} absent today · {sentCount} notified
        </p>
        {skippedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {skippedCount} batch{skippedCount > 1 ? "es" : ""} marked holiday/cancelled today
          </p>
        )}
      </div>

      {absencesQuery.isLoading || sessionsQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No absences recorded for today yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Send</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ absence, student, batch }) => {
                  const sent = !!absence.notifiedAt;
                  const mobile = pickMobile(student);
                  return (
                    <TableRow key={absence.id} className={sent ? "opacity-60" : ""}>
                      <TableCell>
                        <p className="font-medium">
                          #{student.rollNo} {student.name}
                        </p>
                        {!mobile && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            No number on file
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{batch.name}</TableCell>
                      <TableCell className="text-right">
                        {sent ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3 w-3" /> Sent
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!mobile || sendingId === absence.id}
                            onClick={() => send({ absence, student, batch })}
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                            {sendingId === absence.id ? "Opening…" : "Send WhatsApp"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
