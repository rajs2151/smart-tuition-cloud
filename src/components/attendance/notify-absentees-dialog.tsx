import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { buildContext, openWhatsApp, pickMobile, renderMessage } from "@/lib/messaging/whatsapp";
import { logComm, useMessaging } from "@/lib/messaging/store";
import { fmtDate } from "@/lib/format";
import type { AttendanceLanguage } from "@/lib/data/types";
import type { Batch, Student } from "@/lib/data/types";

/**
 * V1 WhatsApp sending is genuinely one-tap-per-parent, not true bulk send
 * (wa.me has no batch mode — PRD §0.1/§9). This auto-advances through the
 * absent list instead of leaving the teacher to hunt down each chat
 * manually: one "Send & Next" tap opens the next parent's pre-filled
 * chat, the teacher still taps Send inside WhatsApp themselves. Built as
 * its own one-at-a-time dialog rather than reusing recovery.tsx's
 * stagger-window.open bulk pattern, since that pattern only reliably
 * opens the first tab in most browsers' popup blockers.
 */
export function NotifyAbsenteesDialog({
  open,
  onOpenChange,
  batch,
  sessionDate,
  absentStudents,
  attendanceLanguage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: Batch;
  sessionDate: string;
  absentStudents: Student[];
  attendanceLanguage: AttendanceLanguage;
}) {
  const { templates } = useMessaging();
  const [index, setIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  const attendanceTemplates = templates.filter((t) => t.category === "attendance");
  const tpl =
    attendanceTemplates.find((t) => t.language === attendanceLanguage) ?? attendanceTemplates[0];

  const withNumber = useMemo(() => absentStudents.filter((s) => pickMobile(s)), [absentStudents]);
  const withoutNumber = useMemo(
    () => absentStudents.filter((s) => !pickMobile(s)),
    [absentStudents],
  );

  const current = withNumber[index];
  const mobile = current ? pickMobile(current) : "";
  const message =
    current && tpl
      ? renderMessage(
          tpl,
          buildContext({
            student: current,
            batch,
            pending: 0,
            extras: { AttendanceDate: fmtDate(sessionDate) },
          }),
        )
      : "";

  const reset = () => {
    setIndex(0);
    setSentCount(0);
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const sendAndNext = () => {
    if (!current || !tpl) return;
    openWhatsApp(mobile, message);
    void logComm({
      studentId: current.id,
      studentName: current.name,
      mobile,
      templateId: tpl.id,
      templateName: tpl.name,
      category: "attendance",
      message,
      sentBy: "attendance",
    });
    setSentCount((c) => c + 1);
    if (index + 1 >= withNumber.length) {
      toast.success(`Sent ${sentCount + 1} of ${withNumber.length} absence notices.`);
      close(false);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const skip = () => {
    if (index + 1 >= withNumber.length) {
      close(false);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (!tpl) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify absentees</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No attendance message template found. Add one in Settings → Message Templates.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            Notify absent parents
          </DialogTitle>
        </DialogHeader>

        {withNumber.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None of today&apos;s absent students have a parent or student phone number on file.
          </p>
        ) : current ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Parent {index + 1} of {withNumber.length}
              </span>
              <Badge variant="secondary">{current.name}</Badge>
            </div>
            <div className="rounded-xl bg-[#e5ddd5] p-3">
              <div className="ml-auto max-w-[92%] rounded-lg bg-[#dcf8c6] p-3 shadow-sm">
                <pre className="whitespace-pre-wrap break-words font-sans text-xs text-foreground">
                  {message}
                </pre>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sends to {mobile}. This opens WhatsApp with the message pre-filled — you still tap
              Send inside WhatsApp yourself for each parent.
            </p>
          </div>
        ) : null}

        {withoutNumber.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              No number on file for {withoutNumber.length} absent student
              {withoutNumber.length > 1 ? "s" : ""}: {withoutNumber.map((s) => s.name).join(", ")}
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            Close
          </Button>
          {current && (
            <>
              <Button variant="ghost" onClick={skip}>
                Skip
              </Button>
              <Button onClick={sendAndNext}>
                <Send className="h-4 w-4" />
                Send &amp; next
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
