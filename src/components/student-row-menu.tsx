import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Pencil, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddStudentDialog } from "@/components/add-student-dialog";

import { deleteStudent, listPaymentsByStudent } from "@/lib/data/adapter";
import { useSession } from "@/lib/auth/session";
import type { Student } from "@/lib/data/types";

export function StudentRowMenu({ student }: { student: Student }) {
  const qc = useQueryClient();
  const session = useSession();
  const isOwner = session.role === "owner";
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [hasHistory, setHasHistory] = useState<boolean | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Owner/Admin-only actions: this app's role model currently only
  // distinguishes "owner" and "staff" (no separate "admin" tier exists
  // yet), so "Owner and Admin" maps to "owner" for now.
  if (!isOwner) return null;

  const openArchiveConfirm = async () => {
    setHasHistory(null);
    setArchiveOpen(true);
    const payments = await listPaymentsByStudent(student.id);
    setHasHistory(payments.length > 0);
  };

  const doArchive = async () => {
    setArchiving(true);
    try {
      await deleteStudent(student.id);
      toast.success("Student archived");
      await qc.invalidateQueries();
      setArchiveOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not archive student");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Student actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit Student
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openArchiveConfirm} className="text-destructive focus:text-destructive">
            <Archive className="h-4 w-4" /> Archive Student
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddStudentDialog student={student} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {student.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasHistory === null
                ? "Checking payment history…"
                : hasHistory
                  ? "This student has payment history. The student will be archived and can be restored later."
                  : "This student will be archived and can be restored later from the Recycle Bin."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doArchive} disabled={archiving || hasHistory === null}>
              {archiving ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
