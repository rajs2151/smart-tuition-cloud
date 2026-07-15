// Central definition of the institute role model and what each role is
// allowed to do in the UI.
//
// This file gates *UI visibility only*. The real security boundary for
// user management (invite / change role / remove) lives in the Postgres
// RPCs (`invite_member`, `change_member_role`, `remove_member`), which
// independently re-check "is this caller the owner?" server-side and
// cannot be bypassed by editing client code. Never treat `can()` as a
// substitute for that.

export type MemberRole = "owner" | "admin" | "teacher" | "accountant" | "staff";

export type Permission =
  | "manage_users"
  | "manage_subscription"
  | "manage_settings"
  | "students"
  | "attendance"
  | "record_payments"
  | "view_receipts"
  | "payments"
  | "receipts"
  | "expenses"
  | "reports"
  | "batches";

// "staff" is the legacy pre-multi-role tier (schema/RLS already
// supported it before this feature). It is not offered for new invites,
// but any existing staff rows keep working — mapped to the same
// permissions as "admin" (operational access, no subscription/user
// management), matching how it was actually used prior to this change.
const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
    "manage_users",
    "manage_subscription",
    "manage_settings",
    "students",
    "attendance",
    "record_payments",
    "view_receipts",
    "payments",
    "receipts",
    "expenses",
    "reports",
    "batches",
  ]),
  admin: new Set<Permission>([
    "manage_settings",
    "students",
    "attendance",
    "record_payments",
    "view_receipts",
    "payments",
    "receipts",
    "expenses",
    "reports",
    "batches",
  ]),
  staff: new Set<Permission>([
    "manage_settings",
    "students",
    "attendance",
    "record_payments",
    "view_receipts",
    "payments",
    "receipts",
    "expenses",
    "reports",
    "batches",
  ]),
  teacher: new Set<Permission>(["students", "attendance", "record_payments", "view_receipts"]),
  accountant: new Set<Permission>(["payments", "receipts", "expenses", "reports"]),
};

export function can(role: MemberRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  staff: "Staff",
};

// Roles offered when inviting someone. Owner is assigned once at
// institute creation, never via invite; "staff" is legacy-only.
export const INVITABLE_ROLES: MemberRole[] = ["admin", "teacher", "accountant"];

export const MAX_INSTITUTE_USERS = 5;
