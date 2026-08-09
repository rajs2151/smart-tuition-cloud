import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/store";
import type { Json } from "@/integrations/supabase/types";

/** Round-trips a value through JSON so it's guaranteed storable in a `jsonb` column. */
function toJsonSafe(value: unknown): Json | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

export type AuditEntity = "student" | "payment" | "batch" | "expense" | "category" | "receipt" | "attendance";
export type AuditAction = "create" | "update" | "delete" | "restore" | "purge" | "void";

export type AuditLog = {
  id: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  by: string;
  at: string;
  summary?: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export type RecycleItem = {
  id: string;        // composite: entity:entityId
  entity: AuditEntity;
  entityId: string;
  label: string;     // human label
  deletedBy: string;
  deletedAt: string;
  payload?: unknown; // snapshot for full restore (optional)
};

/**
 * Writes durable audit rows to Supabase only.
 * Previously also mirrored into `vidyafee.audit.v1` localStorage — that
 * caused Recycle Bin / Audit Log to look empty on other devices. Soft-
 * deleted rows and `audit_logs` are the source of truth now.
 */
export function logAudit(input: Omit<AuditLog, "id" | "at">) {
  const instituteId = getSession().instituteId ?? getSettings().institute.id ?? null;
  if (!instituteId) return;

  // Fire-and-forget: a failed audit write must never block or fail the
  // action being audited.
  supabase
    .from("audit_logs")
    .insert({
      institute_id: instituteId,
      entity: input.entity,
      entity_id: input.entityId,
      action: input.action,
      by_user: getSession().userId,
      summary: input.summary ?? null,
      old_value: toJsonSafe(input.oldValue),
      new_value: toJsonSafe(input.newValue),
    })
    .then(({ error }) => {
      if (error) console.error("audit_logs insert failed:", error);
    });
}

/** @deprecated No-op — Recycle Bin reads soft-deleted rows from Supabase. */
export function addRecycle(_item: Omit<RecycleItem, "id">) {
  /* intentionally empty */
}

/** @deprecated No-op — restore/purge clear `deleted` flags in Supabase. */
export function removeRecycle(_entity: AuditEntity, _entityId: string) {
  /* intentionally empty */
}
