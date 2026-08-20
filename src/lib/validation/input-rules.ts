/**
 * Client-side input rules for person names and fee amounts.
 * Does not touch the database — validation only at the form boundary.
 */

/** Letters (incl. Indic), spaces, apostrophe, dot, hyphen. No digits/symbols. */
const NAME_CHARS = /[^\p{L}\s.'’-]/gu;

export function sanitizePersonName(raw: string): string {
  return raw.replace(NAME_CHARS, "").replace(/\s{2,}/g, " ");
}

export function isValidPersonName(name: string): boolean {
  const t = name.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/\d/.test(t)) return false;
  return /^[\p{L}][\p{L}\s.'’-]*$/u.test(t);
}

export const FEE_LIMITS = {
  courseFee: { min: 0, max: 500_000 },
  admissionFee: { min: 0, max: 100_000 },
  discount: { min: 0, max: 500_000 },
  installmentCount: { min: 1, max: 24 },
  payment: { min: 1, max: 500_000 },
  batchCapacity: { min: 1, max: 500 },
  batchCourseFee: { min: 0, max: 500_000 },
} as const;

export function clampFee(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return min;
  return Math.min(max, Math.round(value));
}

export function parseFeeInput(raw: string, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  return clampFee(n, min, max);
}
