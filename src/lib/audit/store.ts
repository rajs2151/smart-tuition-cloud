import { useSyncExternalStore } from "react";
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

export type AuditEntity = "student" | "payment" | "batch" | "expense" | "category" | "receipt";
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

const KEY = "vidyafee.audit.v1";

type State = { logs: AuditLog[]; recycle: RecycleItem[] };

function load(): State {
  if (typeof window === "undefined") return { logs: [], recycle: [] };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as State) : { logs: [], recycle: [] };
  } catch { return { logs: [], recycle: [] }; }
}

let state: State = load();
const listeners = new Set<() => void>();
function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function emit() { listeners.forEach((l) => l()); }
function set(next: State) { state = next; persist(); emit(); }

export function logAudit(input: Omit<AuditLog, "id" | "at">) {
  const log: AuditLog = {
    ...input,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  };
  set({ ...state, logs: [log, ...state.logs].slice(0, 1000) });

  // Best-effort write-through to the real `audit_logs` table so the entry
  // is durable and shared across devices/staff, not just this browser's
  // localStorage. Fire-and-forget: a failed audit write must never block
  // or fail the action being audited.
  const instituteId = getSession().instituteId ?? getSettings().institute.id ?? null;
  if (!instituteId) return;
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

export function addRecycle(item: Omit<RecycleItem, "id">) {
  const id = `${item.entity}:${item.entityId}`;
  set({
    ...state,
    recycle: [{ id, ...item }, ...state.recycle.filter((r) => r.id !== id)],
  });
}

export function removeRecycle(entity: AuditEntity, entityId: string) {
  set({
    ...state,
    recycle: state.recycle.filter((r) => !(r.entity === entity && r.entityId === entityId)),
  });
}

export function listLogs() { return state.logs; }
export function listRecycle() { return state.recycle; }

export function useAudit(): State {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}
