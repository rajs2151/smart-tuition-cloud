import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, MoreVertical, Trash2, Clock, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSession } from "@/lib/auth/session";
import { can, INVITABLE_ROLES, ROLE_LABELS, type MemberRole } from "@/lib/auth/roles";
import {
  useTeamMembers,
  loadTeamMembers,
  inviteTeamMember,
  changeTeamMemberRole,
  removeTeamMember,
  getSeatUsage,
  canInviteMore,
} from "@/lib/team/store";
import type { TeamMember } from "@/lib/team/types";

export function TeamMembersSection() {
  const { members, loading, error } = useTeamMembers();
  const { role: myRole, userId } = useSession();
  const isOwner = myRole === "owner";
  const canManageUsers = can(myRole, "manage_users");

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const { used, max } = getSeatUsage();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Team Members</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Everyone with access to this institute.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={used >= max ? "destructive" : "secondary"} className="gap-1">
              <Users className="h-3 w-3" /> {used} / {max} Users
            </Badge>
            {canManageUsers && <InviteUserDialog disabled={!canInviteMore()} />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading && members.length === 0 && (
          <p className="text-sm text-muted-foreground">Loading team members…</p>
        )}

        {!loading && members.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        )}

        {members.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {canManageUsers && <th className="w-10 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isSelf={m.userId === userId}
                    canManageUsers={canManageUsers}
                    isOwnerViewer={isOwner}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!canManageUsers && (
          <p className="text-[11px] text-muted-foreground">
            Only the institute owner can invite, change roles, or remove team members.
          </p>
        )}
        {canManageUsers && used >= max && (
          <p className="text-[11px] text-muted-foreground">
            This institute has reached the 5-user limit. Remove a member to invite someone new.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  isSelf,
  canManageUsers,
  isOwnerViewer,
}: {
  member: TeamMember;
  isSelf: boolean;
  canManageUsers: boolean;
  isOwnerViewer: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const isOwnerRow = member.role === "owner";
  // Only the owner may edit others; the owner row itself is never editable
  // (no role change, no removal — matches the RPCs, which reject both).
  const rowEditable = canManageUsers && isOwnerViewer && !isOwnerRow;

  const handleRoleChange = async (role: MemberRole) => {
    setBusy(true);
    try {
      await changeTeamMemberRole(member.id, role);
      toast.success(
        `${member.displayName ?? member.email ?? "Member"}'s role updated to ${ROLE_LABELS[role]}.`,
      );
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't update role.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeTeamMember(member.id);
      toast.success(`${member.displayName ?? member.email ?? "Member"} removed.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't remove member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        {member.displayName || <span className="text-muted-foreground">—</span>}
        {isSelf && <span className="ml-1.5 text-[11px] text-muted-foreground">(you)</span>}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{member.email ?? "—"}</td>
      <td className="px-3 py-2">
        {rowEditable ? (
          <Select
            value={member.role}
            onValueChange={(v) => handleRoleChange(v as MemberRole)}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
        )}
      </td>
      <td className="px-3 py-2">
        {member.status === "pending" ? (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        ) : (
          <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15">Active</Badge>
        )}
      </td>
      {canManageUsers && (
        <td className="px-3 py-2 text-right">
          {rowEditable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleRemove}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      )}
    </tr>
  );
}

function InviteUserDialog({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("admin");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setRole("admin");
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Enter a name");
    if (!email.trim() || !email.includes("@")) return toast.error("Enter a valid Gmail address");
    setSubmitting(true);
    try {
      const member = await inviteTeamMember({ email, name, role });
      toast.success(
        member?.status === "active"
          ? `${name} already has an account and has been added directly.`
          : `Invitation sent — ${name} will be added automatically when they sign in with ${email}.`,
      );
      reset();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't send invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          title={disabled ? "This institute has reached the 5-user limit" : undefined}
        >
          <UserPlus className="h-4 w-4" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Anita Deshmukh"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Gmail address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
            />
            <p className="text-[11px] text-muted-foreground">
              They'll be added automatically the first time they sign in with this account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
