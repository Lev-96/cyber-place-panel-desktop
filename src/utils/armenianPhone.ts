/**
 * Armenian phone numbers on a staff reservation (2026-11-07, owner): typed
 * and shown as `077 777 777`, sent and stored as `+37477777777`. The server
 * normalises the same way and is the judge (`PlaceReservationController`);
 * this only makes typing and pasting easy.
 *
 * National number: 8 digits after the trunk 0 (operator code + subscriber).
 * Accepted in: `077777777`, `077 777 777`, `+374 77 777777`, `37477777777`,
 * `(077) 77-77-77`, `00374 77 777777`, `77777777`.
 */

const NATIONAL_DIGITS = 8;

/** The national digits in whatever was typed or pasted: the country code and the trunk 0 dropped. */
const nationalDigits = (input: string): string => {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00374")) d = d.slice(5);
  else if (d.startsWith("374") && (input.trim().startsWith("+") || d.length > NATIONAL_DIGITS + 1)) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
};

/** What the field shows while typing: `0`, `077`, `077 77`, `077 777 777`. */
export const maskArmenianPhone = (input: string): string => {
  if (input.replace(/\D/g, "") === "") return "";
  const all = `0${nationalDigits(input).slice(0, NATIONAL_DIGITS)}`;
  return [all.slice(0, 3), all.slice(3, 6), all.slice(6, 9)].filter(Boolean).join(" ");
};

/** `+374XXXXXXXX`, or null when it is not a whole Armenian number. */
export const normalizeArmenianPhone = (input: string): string | null => {
  const d = nationalDigits(input);
  // As the server (`App\Support\ArmenianPhone`): eight digits, never starting with 0.
  return /^[1-9]\d{7}$/.test(d) ? `+374${d}` : null;
};

/** A stored number for people: `077 777 777`; anything else as it was stored. */
export const formatArmenianPhone = (stored: string | null | undefined): string => {
  if (!stored) return "";
  const n = normalizeArmenianPhone(stored);
  return n ? maskArmenianPhone(n) : stored;
};
