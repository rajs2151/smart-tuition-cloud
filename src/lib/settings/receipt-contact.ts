import type { InstituteProfile, ReceiptConfig } from "@/lib/data/types";

/**
 * Splits a raw phone-number field into individual numbers. Accepts
 * newline-separated, comma-separated, or a single number — all of
 * "8637769576\n9021123456", "8637769576, 9021123456" and "8637769576"
 * parse correctly.
 */
export function parsePhoneList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Renders a raw phone field the way it should appear on a receipt: "8637769576 • 9021123456". */
export function formatPhoneList(raw: string | null | undefined): string {
  return parsePhoneList(raw).join(" • ");
}

export interface EffectiveReceiptContact {
  phone: string;
  email: string;
  website: string;
}

/**
 * Resolves what a receipt should actually show for phone/email/website.
 *
 * Priority (per field, independently):
 *   1. Receipt Configuration override, if one is set
 *   2. Institute Settings value
 *
 * This is the single place that priority logic lives — the Receipt
 * Configuration form uses it to show a live preview, and the receipt
 * renderer uses it to build the header, so the two can never drift apart.
 */
export function getEffectiveReceiptContact(
  institute: InstituteProfile,
  receipt: ReceiptConfig,
): EffectiveReceiptContact {
  const phone = receipt.phoneOverride?.trim()
    ? formatPhoneList(receipt.phoneOverride)
    : formatPhoneList(institute.phone);
  const email = receipt.emailOverride?.trim() || institute.email;
  const website = receipt.websiteOverride?.trim() || institute.website || "";
  return { phone, email, website };
}
