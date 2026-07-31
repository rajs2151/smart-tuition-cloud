import { useSyncExternalStore } from "react";
import {
  DEFAULT_TEMPLATES,
  DEFAULT_TEMPLATE_SELECTION,
  type DefaultTemplateMap,
  type MessageTemplate,
  type TemplateCategory,
} from "./templates";

const KEY = "vidyafee.messaging.v1";

export type CommLog = {
  id: string;
  date: string; // ISO
  studentId: string;
  studentName: string;
  mobile: string;
  templateId: string;
  templateName: string;
  category: TemplateCategory;
  message: string;
  sentBy: string;
  paymentReceivedAfter?: boolean;
};

type State = {
  templates: MessageTemplate[];
  defaults: DefaultTemplateMap;
  logs: CommLog[];
};

const initial: State = {
  templates: DEFAULT_TEMPLATES,
  defaults: DEFAULT_TEMPLATE_SELECTION,
  logs: [],
};

/**
 * Reconciles persisted templates with the current code's built-ins.
 * Fixes the class of bug where a NEW built-in template (e.g. the
 * attendance category added after this account was already active)
 * never reaches an existing account, because the old all-or-nothing
 * fallback (`parsed.templates?.length ? parsed.templates : DEFAULT_TEMPLATES`)
 * used the stale persisted array wholesale instead of merging in
 * additions. Anything the user customized (edited built-in, or a fully
 * custom template) is kept as-is via the id match; only built-ins with
 * no matching persisted id get appended.
 */
function mergeTemplates(persisted: MessageTemplate[] | undefined): MessageTemplate[] {
  if (!persisted?.length) return DEFAULT_TEMPLATES;
  const existingIds = new Set(persisted.map((t) => t.id));
  const missingBuiltIns = DEFAULT_TEMPLATES.filter((t) => !existingIds.has(t.id));
  return missingBuiltIns.length ? [...persisted, ...missingBuiltIns] : persisted;
}

/**
 * Defensive complement to mergeTemplates: even once templates are
 * merged, a persisted default could in principle point at an id that no
 * longer exists in the merged set. Falls back to the first template in
 * that category rather than leaving a dangling reference.
 */
function resolveDefaults(
  templates: MessageTemplate[],
  persisted: Partial<DefaultTemplateMap> | undefined,
): DefaultTemplateMap {
  const merged = { ...DEFAULT_TEMPLATE_SELECTION, ...(persisted ?? {}) };
  const categories = Object.keys(DEFAULT_TEMPLATE_SELECTION) as (keyof DefaultTemplateMap)[];
  for (const cat of categories) {
    const stillExists = templates.some((t) => t.id === merged[cat]);
    if (!stillExists) {
      const fallback = templates.find((t) => t.category === cat);
      if (fallback) merged[cat] = fallback.id;
    }
  }
  return merged;
}

function load(): State {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<State>;
    const templates = mergeTemplates(parsed.templates);
    return {
      templates,
      defaults: resolveDefaults(templates, parsed.defaults),
      logs: parsed.logs ?? [],
    };
  } catch {
    return initial;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
// Write the healed state back immediately, so an account that never
// triggers another set() call (e.g. only ever reads, never edits
// templates) still ends up with the merged data on disk, not just in
// memory for this one session.
persist();
function emit() {
  listeners.forEach((l) => l());
}
function set(next: State) {
  state = next;
  persist();
  emit();
}

export function getMessaging() {
  return state;
}

// --- Templates ---
export function upsertTemplate(t: MessageTemplate) {
  const exists = state.templates.find((x) => x.id === t.id);
  const templates = exists
    ? state.templates.map((x) => (x.id === t.id ? t : x))
    : [...state.templates, t];
  set({ ...state, templates });
}
export function deleteTemplate(id: string) {
  const t = state.templates.find((x) => x.id === id);
  if (!t || t.builtIn) return;
  set({ ...state, templates: state.templates.filter((x) => x.id !== id) });
}
export function restoreDefaults() {
  // Replace built-ins with shipped defaults, keep custom templates.
  const custom = state.templates.filter((t) => !t.builtIn);
  set({ ...state, templates: [...DEFAULT_TEMPLATES, ...custom] });
}
export function setDefaultTemplate(category: keyof DefaultTemplateMap, id: string) {
  set({ ...state, defaults: { ...state.defaults, [category]: id } });
}

// --- History ---
export function logComm(entry: Omit<CommLog, "id" | "date"> & { date?: string }) {
  const log: CommLog = {
    ...entry,
    id: `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    date: entry.date ?? new Date().toISOString(),
  };
  set({ ...state, logs: [log, ...state.logs].slice(0, 500) });
  return log;
}
export function markLogPaid(studentId: string) {
  set({
    ...state,
    logs: state.logs.map((l) =>
      l.studentId === studentId && l.category === "reminder"
        ? { ...l, paymentReceivedAfter: true }
        : l,
    ),
  });
}

export function useMessaging(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => initial,
  );
}
