import { useSyncExternalStore } from "react";
import type {
  AppSettings,
  Board,
  ExamCategory,
  InstituteProfile,
  MasterSettings,
  Medium,
  ReceiptConfig,
  Standard,
} from "@/lib/data/types";

const STORAGE_KEY = "vidyafee.settings.v1";

export const DEFAULT_INSTITUTE: InstituteProfile = {
  id: "inst_default",
  name: "Dnyanpeeth Classes",
  logoUrl: "",
  address: "FC Road, Pune, Maharashtra 411004",
  phone: "+91 98765 43210",
  email: "hello@dnyanpeeth.in",
  website: "www.dnyanpeeth.in",
  gstNumber: "27ABCDE1234F1Z5",
};

export const DEFAULT_RECEIPT: ReceiptConfig = {
  prefix: "REC",
  nextNumber: 1001,
  footerText: "Thank you for your payment. This is a computer-generated receipt.",
  termsAndConditions:
    "1. Fees once paid are non-refundable.\n2. Receipt valid only after realization of payment.\n3. Please retain this receipt for future reference.",
  authorizedSignatory: "Authorized Signatory",
  showGst: true,
  showLogo: true,
  showFooter: true,
};

export const DEFAULT_MASTER: MasterSettings = {
  standards: [
    "1st", "2nd", "3rd", "4th", "5th", "6th",
    "7th", "8th", "9th", "10th", "11th", "12th",
  ],
  boards: ["State Board", "CBSE"],
  mediums: ["Marathi", "Semi English", "English"],
  examCategories: ["JEE", "NEET"],
};

export const DEFAULT_SETTINGS: AppSettings = {
  institute: DEFAULT_INSTITUTE,
  receipt: DEFAULT_RECEIPT,
  master: DEFAULT_MASTER,
};

let state: AppSettings = load();
const listeners = new Set<() => void>();

function load(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      institute: { ...DEFAULT_INSTITUTE, ...(parsed.institute ?? {}) },
      receipt: { ...DEFAULT_RECEIPT, ...(parsed.receipt ?? {}) },
      master: { ...DEFAULT_MASTER, ...(parsed.master ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getSettings(): AppSettings {
  return state;
}

export function setInstitute(patch: Partial<InstituteProfile>) {
  state = { ...state, institute: { ...state.institute, ...patch } };
  persist();
  emit();
}
export function setReceiptConfig(patch: Partial<ReceiptConfig>) {
  state = { ...state, receipt: { ...state.receipt, ...patch } };
  persist();
  emit();
}
export function setMaster(patch: Partial<MasterSettings>) {
  state = { ...state, master: { ...state.master, ...patch } };
  persist();
  emit();
}

export function addMasterValue(
  key: keyof MasterSettings,
  value: string,
) {
  const list = state.master[key] as string[];
  if (!value.trim() || list.includes(value)) return;
  setMaster({ [key]: [...list, value] } as Partial<MasterSettings>);
}
export function removeMasterValue(key: keyof MasterSettings, value: string) {
  const list = state.master[key] as string[];
  setMaster({ [key]: list.filter((v) => v !== value) } as Partial<MasterSettings>);
}

export function nextReceiptNumber(): string {
  const n = state.receipt.nextNumber;
  setReceiptConfig({ nextNumber: n + 1 });
  return `${state.receipt.prefix}-${n}`;
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => DEFAULT_SETTINGS,
  );
}

// Convenience typed re-exports
export type { Standard, Board, Medium, ExamCategory };
