import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth/session";
import { MAX_INSTITUTE_USERS, type MemberRole } from "@/lib/auth/roles";
import type { TeamMember } from "./types";

type State = {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
};

let state: State = { members: [], loading: false, error: null };
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): TeamMember {
  return {
    id: row.id,
    instituteId: row.institute_id,
    userId: row.user_id,
    role: row.role as MemberRole,
    accessEnabled: !!row.access_enabled,
    status: row.status as TeamMemberStatusInternal,
    displayName: row.display_name ?? null,
    email: row.invited_email ?? null,
    invitedAt: row.invited_at,
    createdAt: row.created_at,
  };
}
type TeamMemberStatusInternal = TeamMember["status"];

/** Loads every member (active + pending) of the current institute. Call on entering Settings → Team Members. */
export async function loadTeamMembers() {
  const instituteId = getSession().instituteId;
  if (!instituteId) return;
  set({ loading: true, error: null });
  const { data, error } = await supabase
    .from("institute_members")
    .select("*")
    .eq("institute_id", instituteId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[team] load error", error);
    set({ loading: false, error: "Couldn't load team members. Please try again." });
    return;
  }
  set({ loading: false, members: (data ?? []).map(fromRow) });
}

export function getTeamMembers(): TeamMember[] {
  return state.members;
}

export function getSeatUsage(): { used: number; max: number } {
  return { used: state.members.length, max: MAX_INSTITUTE_USERS };
}

export function canInviteMore(): boolean {
  return state.members.length < MAX_INSTITUTE_USERS;
}

export async function inviteTeamMember(input: { email: string; name: string; role: MemberRole }) {
  const instituteId = getSession().instituteId;
  if (!instituteId) throw new Error("No active institute");

  const { data, error } = await supabase.rpc("invite_member", {
    _institute: instituteId,
    _email: input.email,
    _name: input.name,
    _role: input.role,
  });
  if (error) throw error;
  if (data) set({ members: [...state.members, fromRow(data)] });
  return data ? fromRow(data) : null;
}

export async function changeTeamMemberRole(memberId: string, role: MemberRole) {
  const instituteId = getSession().instituteId;
  if (!instituteId) throw new Error("No active institute");

  const { data, error } = await supabase.rpc("change_member_role", {
    _institute: instituteId,
    _member_id: memberId,
    _role: role,
  });
  if (error) throw error;
  if (data) {
    const updated = fromRow(data);
    set({ members: state.members.map((m) => (m.id === memberId ? updated : m)) });
    return updated;
  }
  return null;
}

export async function removeTeamMember(memberId: string) {
  const instituteId = getSession().instituteId;
  if (!instituteId) throw new Error("No active institute");

  const { error } = await supabase.rpc("remove_member", {
    _institute: instituteId,
    _member_id: memberId,
  });
  if (error) throw error;
  set({ members: state.members.filter((m) => m.id !== memberId) });
}

/**
 * Resolve an audit log's `by` value to a display name, for Recent
 * Activity (recycle-bin.tsx).
 *
 * `by` is populated by src/lib/data/adapter.ts's `currentUser()`, which
 * returns `getSession().email` — an email string, not this member's
 * userId (a separate, real user id is written server-side to
 * audit_logs.by_user, but that column isn't queried/rendered by
 * Recent Activity today; this resolves the client-rendered value).
 * Matched against both userId and email so this keeps working
 * unchanged if `by` is ever switched to a real user id later.
 *
 * Falls back gracefully if the team list hasn't been loaded yet or the
 * actor is no longer a member.
 *
 * Usage in Recent Activity / recycle-bin.tsx:
 *   import { getActorName } from "@/lib/team/store";
 *   ...
 *   <span>{getActorName(log.by)} {describeAction(log)}</span>
 */
export function getActorName(actor: string | null | undefined): string {
  if (!actor) return "Someone";
  const needle = actor.toLowerCase();
  const member = state.members.find((m) => m.userId === actor || m.email?.toLowerCase() === needle);
  return member?.displayName || member?.email || "A team member";
}

export function useTeamMembers(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
