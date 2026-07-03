import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export const DEFAULT_INSTITUTE: InstituteProfile = {
  id: "",
  name: "",
  logoUrl: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  gstNumber: "",
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
    "1st","2nd","3rd","4th","5th","6th",
    "7th","8th","9th","10th","11th","12th",
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

let state: AppSettings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function getSettings(): AppSettings { return state; }

/** Called by session bootstrapping with the loaded institute row from Supabase. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hydrateSettingsFromDb(row: any) {
  state = {
    institute: {
      id: row.id,
      name: row.name ?? "",
      logoUrl: row.logo_url ?? "",
      address: row.address ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      website: row.website ?? "",
      gstNumber: row.gst_number ?? "",
    },
    receipt: {
      prefix: row.receipt_prefix ?? "REC",
      nextNumber: row.receipt_next_number ?? 1001,
      footerText: row.receipt_footer_text ?? "",
      termsAndConditions: row.receipt_terms ?? "",
      authorizedSignatory: row.receipt_authorized_signatory ?? "Authorized Signatory",
      showGst: !!row.receipt_show_gst,
      showLogo: row.receipt_show_logo ?? true,
      showFooter: row.receipt_show_footer ?? true,
    },
    master: {
      standards: (row.master_standards ?? DEFAULT_MASTER.standards) as Standard[],
      boards: (row.master_boards ?? DEFAULT_MASTER.boards) as Board[],
      mediums: (row.master_mediums ?? DEFAULT_MASTER.mediums) as Medium[],
      examCategories: (row.master_exam_categories ?? DEFAULT_MASTER.examCategories) as ExamCategory[],
    },
  };
  emit();
}

export function resetSettings() {
  state = DEFAULT_SETTINGS;
  emit();
}

async function pushInstituteUpdate(patch: Record<string, unknown>) {
  if (!state.institute.id) return;
  const { error } = await supabase
    .from("institutes")
    .update(patch)
    .eq("id", state.institute.id);
  if (error) console.error("[settings] institute update", error);
}

export function setInstitute(patch: Partial<InstituteProfile>) {
  state = { ...state, institute: { ...state.institute, ...patch } };
  emit();
  const dbPatch: Record<string, unknown> = {};
  if ("name" in patch) dbPatch.name = patch.name;
  if ("logoUrl" in patch) dbPatch.logo_url = patch.logoUrl;
  if ("address" in patch) dbPatch.address = patch.address;
  if ("phone" in patch) dbPatch.phone = patch.phone;
  if ("email" in patch) dbPatch.email = patch.email;
  if ("website" in patch) dbPatch.website = patch.website;
  if ("gstNumber" in patch) dbPatch.gst_number = patch.gstNumber;
  if (Object.keys(dbPatch).length) void pushInstituteUpdate(dbPatch);
}

export function setReceiptConfig(patch: Partial<ReceiptConfig>) {
  state = { ...state, receipt: { ...state.receipt, ...patch } };
  emit();
  const dbPatch: Record<string, unknown> = {};
  if ("prefix" in patch) dbPatch.receipt_prefix = patch.prefix;
  if ("nextNumber" in patch) dbPatch.receipt_next_number = patch.nextNumber;
  if ("footerText" in patch) dbPatch.receipt_footer_text = patch.footerText;
  if ("termsAndConditions" in patch) dbPatch.receipt_terms = patch.termsAndConditions;
  if ("authorizedSignatory" in patch) dbPatch.receipt_authorized_signatory = patch.authorizedSignatory;
  if ("showGst" in patch) dbPatch.receipt_show_gst = patch.showGst;
  if ("showLogo" in patch) dbPatch.receipt_show_logo = patch.showLogo;
  if ("showFooter" in patch) dbPatch.receipt_show_footer = patch.showFooter;
  if (Object.keys(dbPatch).length) void pushInstituteUpdate(dbPatch);
}

export function setMaster(patch: Partial<MasterSettings>) {
  state = { ...state, master: { ...state.master, ...patch } };
  emit();
  const dbPatch: Record<string, unknown> = {};
  if ("standards" in patch) dbPatch.master_standards = patch.standards;
  if ("boards" in patch) dbPatch.master_boards = patch.boards;
  if ("mediums" in patch) dbPatch.master_mediums = patch.mediums;
  if ("examCategories" in patch) dbPatch.master_exam_categories = patch.examCategories;
  if (Object.keys(dbPatch).length) void pushInstituteUpdate(dbPatch);
}

export function addMasterValue(key: keyof MasterSettings, value: string) {
  const list = state.master[key] as string[];
  if (!value.trim() || list.includes(value)) return;
  setMaster({ [key]: [...list, value] } as Partial<MasterSettings>);
}
export function removeMasterValue(key: keyof MasterSettings, value: string) {
  const list = state.master[key] as string[];
  setMaster({ [key]: list.filter((v) => v !== value) } as Partial<MasterSettings>);
}

/**
 * Legacy synchronous receipt-number generator used by non-DB code paths.
 * The Supabase-backed adapter uses the `next_receipt_number` RPC instead
 * so numbers are allocated atomically per institute.
 */
export function nextReceiptNumber(): string {
  const n = state.receipt.nextNumber;
  setReceiptConfig({ nextNumber: n + 1 });
  return `${state.receipt.prefix}-${String(n).padStart(4, "0")}`;
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

export type { Standard, Board, Medium, ExamCategory };
