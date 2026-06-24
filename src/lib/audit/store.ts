import { useSyncExternalStore } from "react";

export type AuditEntity = "student" | "payment" | "batch" | "expense" | "category" | "receipt";
export type AuditAction = "create" | "update" | "delete" | "restore" | "purge";

export type AuditLog = {
  id: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  by: string;
  at: string;
  summary?: string;
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
