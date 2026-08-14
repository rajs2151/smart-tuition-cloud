import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AppSettings,
  AttendanceSettings,
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
  // Receipt Contact Details overrides. null = "Use Institute Information"
  // (the default) — the receipt falls back to the Institute tab's values.
  // These are intentionally the only new fields: no separate boolean flags,
  // so there's nothing that can drift out of sync with the override text.
  phoneOverride: null,
  emailOverride: null,
  websiteOverride: null,
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

export const DEFAULT_ATTENDANCE: AttendanceSettings = {
  language: "English",
  lockTime: null,
};

export const DEFAULT_FOLLOW_UP_THRESHOLD = 40;

export const DEFAULT_SETTINGS: AppSettings = {
  institute: DEFAULT_INSTITUTE,
  receipt: DEFAULT_RECEIPT,
  master: DEFAULT_MASTER,
  attendance: DEFAULT_ATTENDANCE,
  followUpThreshold: DEFAULT_FOLLOW_UP_THRESHOLD,
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
      phoneOverride: row.receipt_phone_override ?? null,
      emailOverride: row.receipt_email_override ?? null,
      websiteOverride: row.receipt_website_override ?? null,
    },
    master: {
      standards: (row.master_standards ?? DEFAULT_MASTER.standards) as Standard[],
      boards: (row.master_boards ?? DEFAULT_MASTER.boards) as Board[],
      mediums: (row.master_mediums ?? DEFAULT_MASTER.mediums) as Medium[],
      examCategories: (row.master_exam_categories ?? DEFAULT_MASTER.examCategories) as ExamCategory[],
    },
    attendance: {
      language: (row.attendance_language ?? DEFAULT_ATTENDANCE.language) as AttendanceSettings["language"],
      lockTime: row.attendance_lock_time ?? null,
    },
    followUpThreshold: Number(row.follow_up_threshold ?? DEFAULT_FOLLOW_UP_THRESHOLD) || DEFAULT_FOLLOW_UP_THRESHOLD,
  };
  emit();
}

export function resetSettings() {
  state = DEFAULT_SETTINGS;
  emit();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pushInstituteUpdate(patch: any): Promise<boolean> {
  if (!state.institute.id) return false;
  const { error } = await supabase
    .from("institutes")
    .update(patch)
    .eq("id", state.institute.id);
  if (error) {
    console.error("[settings] institute update", error);
    return false;
  }
  return true;
}

export async function setInstitute(patch: Partial<InstituteProfile>) {
  const previous = state.institute;
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
  if (!Object.keys(dbPatch).length) return;
  const ok = await pushInstituteUpdate(dbPatch);
  if (!ok) {
    // The DB write failed — don't leave the UI showing values that were
    // never actually saved. Roll back to what's really in the database
    // and let the caller know, instead of silently keeping the
    // optimistic (wrong) state around until the next hydration quietly
    // overwrites it.
    state = { ...state, institute: previous };
    emit();
    throw new Error("Couldn't save institute settings. Please try again.");
  }
}

export async function setReceiptConfig(patch: Partial<ReceiptConfig>) {
  const previous = state.receipt;
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
  if ("phoneOverride" in patch) dbPatch.receipt_phone_override = patch.phoneOverride;
  if ("emailOverride" in patch) dbPatch.receipt_email_override = patch.emailOverride;
  if ("websiteOverride" in patch) dbPatch.receipt_website_override = patch.websiteOverride;
  if (!Object.keys(dbPatch).length) return;
  const ok = await pushInstituteUpdate(dbPatch);
  if (!ok) {
    // Same reasoning as setInstitute above — this is the exact write path
    // "Use Institute Email/Phone/Website" and their override text go
    // through. If this silently no-ops (e.g. the column doesn't exist yet
    // because a migration was committed but never deployed), the old
    // behavior was: show "saved", keep the optimistic value on screen,
    // then quietly revert to the real (unsaved) DB value on next
    // hydration — which is precisely the reported bug. Rolling back
    // immediately and throwing makes that failure visible right away
    // instead of only after a refresh/relogin.
    state = { ...state, receipt: previous };
    emit();
    throw new Error("Couldn't save receipt settings. Please try again.");
  }
}

export async function setFollowUpThreshold(value: number) {
  const previous = state.followUpThreshold;
  state = { ...state, followUpThreshold: value };
  emit();
  const ok = await pushInstituteUpdate({ follow_up_threshold: value });
  if (!ok) {
    state = { ...state, followUpThreshold: previous };
    emit();
    throw new Error("Couldn't save follow-up threshold. Please try again.");
  }
}

export async function setAttendanceSettings(patch: Partial<AttendanceSettings>) {
  const previous = state.attendance;
  state = { ...state, attendance: { ...state.attendance, ...patch } };
  emit();
  const dbPatch: Record<string, unknown> = {};
  if ("language" in patch) dbPatch.attendance_language = patch.language;
  if ("lockTime" in patch) dbPatch.attendance_lock_time = patch.lockTime;
  if (!Object.keys(dbPatch).length) return;
  const ok = await pushInstituteUpdate(dbPatch);
  if (!ok) {
    state = { ...state, attendance: previous };
    emit();
    throw new Error("Couldn't save attendance settings. Please try again.");
  }
}

export async function setMaster(patch: Partial<MasterSettings>) {
  const previous = state.master;
  state = { ...state, master: { ...state.master, ...patch } };
  emit();
  const dbPatch: Record<string, unknown> = {};
  if ("standards" in patch) dbPatch.master_standards = patch.standards;
  if ("boards" in patch) dbPatch.master_boards = patch.boards;
  if ("mediums" in patch) dbPatch.master_mediums = patch.mediums;
  if ("examCategories" in patch) dbPatch.master_exam_categories = patch.examCategories;
  if (!Object.keys(dbPatch).length) return;
  const ok = await pushInstituteUpdate(dbPatch);
  if (!ok) {
    state = { ...state, master: previous };
    emit();
    throw new Error("Couldn't save. Please try again.");
  }
}

export function addMasterValue(key: keyof MasterSettings, value: string) {
  const list = state.master[key] as string[];
  if (!value.trim() || list.includes(value)) return;
  void setMaster({ [key]: [...list, value] } as Partial<MasterSettings>).catch((e) =>
    console.error("[settings] addMasterValue failed", e),
  );
}
export function removeMasterValue(key: keyof MasterSettings, value: string) {
  const list = state.master[key] as string[];
  void setMaster({ [key]: list.filter((v) => v !== value) } as Partial<MasterSettings>).catch((e) =>
    console.error("[settings] removeMasterValue failed", e),
  );
}

/**
 * Legacy synchronous receipt-number generator used by non-DB code paths.
 * The Supabase-backed adapter uses the `next_receipt_number` RPC instead
 * so numbers are allocated atomically per institute.
 */
export function nextReceiptNumber(): string {
  const n = state.receipt.nextNumber;
  void setReceiptConfig({ nextNumber: n + 1 }).catch((e) =>
    console.error("[settings] nextReceiptNumber save failed", e),
  );
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

export type { Standard, Board, Medium, ExamCategory, AttendanceSettings };
