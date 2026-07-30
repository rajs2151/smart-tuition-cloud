import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, MessageCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { listSessionAbsences, markAbsenceNotified } from "@/lib/data/adapter";
import { logComm, useMessaging } from "@/lib/messaging/store";
import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";
import { fmtDate } from "@/lib/format";
import type { AttendanceLanguage, AttendanceSession, Batch, Student } from "@/lib/data/types";

/**
 * The "WhatsApp section" — one row per absent student for a specific,
 * already-recorded day. Distinct from NotifyAbsenteesDialog's one-shot
 * auto-advance flow right after saving: this is for coming back later
 * (different day, different device, partial progress) and seeing exactly
 * who's still unnotified. Sent state (`notified_at`) lives in the DB via
 * markAbsenceNotified, not just local state, so it survives a refresh.
 */
export function DayNotifyList({
  batch,
  session,
  students,
  attendanceLanguage,
  onBack,
}: {
  batch: Batch;
  session: AttendanceSession;
  students: Student[];
  attendanceLanguage: AttendanceLanguage;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { templates } = useMessaging();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const absencesQuery = useQuery({
    queryKey: ["attendance-session-absences", session.id],
    queryFn: () => listSessionAbsences(session.id),
  });
  const absences = useMemo(() => absencesQuery.data ?? [], [absencesQuery.data]);

  const attendanceTemplates = templates.filter((t) => t.category === "attendance");
  const tpl =
    attendanceTemplates.find((t) => t.language === attendanceLanguage) ?? attendanceTemplates[0];

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const rows = useMemo(() => {
    return absences
      .map((a) => ({ absence: a, student: studentById.get(a.studentId) }))
      .filter((r): r is { absence: (typeof absences)[number]; student: Student } => !!r.student)
      .sort((a, b) => {
        // Pending first, sent sink to the bottom — within each group, roll no order.
        const aSent = a.absence.notifiedAt ? 1 : 0;
        const bSent = b.absence.notifiedAt ? 1 : 0;
        if (aSent !== bSent) return aSent - bSent;
        return a.student.rollNo.localeCompare(b.student.rollNo, undefined, { numeric: true });
      });
  }, [absences, studentById]);

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
        batch,
        extras: { AttendanceDate: fmtDate(session.sessionDate) },
      }),
    );
    setSendingId(row.absence.id);
    try {
      openWhatsApp(mobile, message);
      logComm({
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
      await qc.invalidateQueries({ queryKey: ["attendance-session-absences", session.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark this as sent.");
    } finally {
      setSendingId(null);
    }
  };

  const sentCount = rows.filter((r) => r.absence.notifiedAt).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to day list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="font-display font-bold leading-tight">
            {batch.name} · {fmtDate(session.sessionDate)}
          </p>
          <p className="text-xs text-muted-foreground">
            {rows.length} absent · {sentCount} notified
          </p>
        </div>
      </div>

      {absencesQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Everyone was present this day.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ absence, student }) => {
            const sent = !!absence.notifiedAt;
            const mobile = pickMobile(student);
            return (
              <div
                key={absence.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
                  sent ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    #{student.rollNo} {student.name}
                  </p>
                  {!mobile && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      No number on file
                    </p>
                  )}
                </div>
                {sent ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" /> Sent
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!mobile || sendingId === absence.id}
                    onClick={() => send({ absence, student })}
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                    {sendingId === absence.id ? "Opening…" : "Send WhatsApp"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
