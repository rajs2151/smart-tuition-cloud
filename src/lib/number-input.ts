// React quirk: for a controlled <input type="number">, React skips forcing
// the DOM's displayed string to match the value prop whenever the *parsed*
// number is already equal to the incoming value (this exists so users can
// type things like a trailing decimal point without React reverting them).
// That means typing "1" right after a "0" produces the DOM string "01" —
// Number("01") is 1, which already matches the new state, so React never
// rewrites the DOM and the stray leading zero just sits there forever.
//
// The fix: strip leading zeros from the input element's value directly (so
// the DOM is corrected immediately, independent of React's reconciliation),
// and return the cleaned string for the caller to parse into state.
export function sanitizeNumberInput(input: HTMLInputElement): string {
  const cleaned = input.value.replace(/^0+(?=\d)/, "");
  if (cleaned !== input.value) input.value = cleaned;
  return cleaned;
}
