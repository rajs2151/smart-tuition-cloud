import type { MemberRole } from "@/lib/auth/roles";

export type TeamMemberStatus = "pending" | "active";

export type TeamMember = {
  id: string;
  instituteId: string;
  userId: string | null;
  role: MemberRole;
  accessEnabled: boolean;
  status: TeamMemberStatus;
  displayName: string | null;
  /**
   * Email the person was invited with. Persisted even after the
   * invitation is accepted, since the client has no other way to read
   * an active member's email (authenticated clients cannot SELECT
   * auth.users directly).
   */
  email: string | null;
  invitedAt: string;
  createdAt: string;
};
