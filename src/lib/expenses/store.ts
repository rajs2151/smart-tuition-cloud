import { useSyncExternalStore } from "react";
import type { Expense, ExpenseCategory } from "./types";
import { DEFAULT_CATEGORIES } from "./defaults";
import { getSettings } from "@/lib/settings/store";
import { logAudit } from "@/lib/audit/store";

const KEY = "vidyafee.expenses.v1";

type State = {
  categories: ExpenseCategory[];
  expenses: Expense[];
};

function load(): State {
  if (typeof window === "undefined") return { categories: DEFAULT_CATEGORIES, expenses: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { categories: DEFAULT_CATEGORIES, expenses: [] };
    const parsed = JSON.parse(raw) as Partial<State>;
    // Merge defaults that don't yet exist (preserve user overrides)
    const userCats = parsed.categories ?? [];
    const have = new Set(userCats.map((c) => c.id));
    const merged = [...userCats, ...DEFAULT_CATEGORIES.filter((c) => !have.has(c.id))];
    return { categories: merged, expenses: parsed.expenses ?? [] };
  } catch {
    return { categories: DEFAULT_CATEGORIES, expenses: [] };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function emit() { listeners.forEach((l) => l()); }
function update(next: State) { state = next; persist(); emit(); }

const currentUser = () => "Owner";
const tenantId = () => getSettings().institute.id;

// ---- Categories ----
export function listCategories() { return state.categories; }
export function addCategory(name: string, group = "Custom"): ExpenseCategory {
  const cat: ExpenseCategory = {
    id: `cat_custom_${Date.now()}`,
    name: name.trim(),
    group,
    active: true,
    custom: true,
  };
  update({ ...state, categories: [...state.categories, cat] });
  return cat;
}
export function renameCategory(id: string, name: string) {
  update({
    ...state,
    categories: state.categories.map((c) => c.id === id ? { ...c, name } : c),
  });
}
export function toggleCategory(id: string, active: boolean) {
  update({
    ...state,
    categories: state.categories.map((c) => c.id === id ? { ...c, active } : c),
  });
}
export function deleteCategory(id: string) {
  update({ ...state, categories: state.categories.filter((c) => c.id !== id) });
}

// ---- Expenses ----
export function listExpenses(includeDeleted = false): Expense[] {
  return state.expenses.filter((e) => includeDeleted || !e.deleted);
}
export function listDeletedExpenses(): Expense[] {
  return state.expenses.filter((e) => e.deleted);
}

export function createExpense(
  input: Omit<Expense, "id" | "instituteId" | "createdAt" | "createdBy">,
): Expense {
  const exp: Expense = {
    ...input,
    id: `exp_${Date.now()}`,
    instituteId: tenantId(),
    createdAt: new Date().toISOString(),
    createdBy: currentUser(),
  };
  update({ ...state, expenses: [exp, ...state.expenses] });
  logAudit({ entity: "expense", entityId: exp.id, action: "create", by: currentUser(), summary: `Added expense ₹${exp.amount}` });
  return exp;
}

export function updateExpense(id: string, patch: Partial<Expense>) {
  update({
    ...state,
    expenses: state.expenses.map((e) => e.id === id ? {
      ...e, ...patch, updatedAt: new Date().toISOString(), updatedBy: currentUser(),
    } : e),
  });
  logAudit({ entity: "expense", entityId: id, action: "update", by: currentUser(), summary: `Edited expense` });
}

export function softDeleteExpense(id: string) {
  update({
    ...state,
    expenses: state.expenses.map((e) => e.id === id ? {
      ...e, deleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser(),
    } : e),
  });
  logAudit({ entity: "expense", entityId: id, action: "delete", by: currentUser(), summary: `Moved expense to recycle bin` });
}

export function restoreExpense(id: string) {
  update({
    ...state,
    expenses: state.expenses.map((e) => e.id === id ? {
      ...e, deleted: false, deletedAt: undefined, deletedBy: undefined,
    } : e),
  });
  logAudit({ entity: "expense", entityId: id, action: "restore", by: currentUser(), summary: `Restored expense` });
}

export function purgeExpense(id: string) {
  update({ ...state, expenses: state.expenses.filter((e) => e.id !== id) });
  logAudit({ entity: "expense", entityId: id, action: "purge", by: currentUser(), summary: `Permanently deleted expense` });
}

export function useExpenseStore(): State {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}
