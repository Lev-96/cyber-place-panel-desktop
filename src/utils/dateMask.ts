/**
 * Two-digit-year date helpers for a `dd.mm.yy` text field.
 *
 * A form keeps a canonical ISO (`YYYY-MM-DD`) value for the API, but the
 * user edits it as `dd.mm.yy` (a two-digit year, mapped to 20YY). These
 * pure conversions keep that mapping in one tested place so the masked
 * input (`MaskedDateInput`) stays dumb.
 */

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** "2026-06-02" → "02.06.26". Returns "" for anything not a full ISO date. */
export const isoToDmy = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}.${mo}.${y.slice(2)}`;
};

/**
 * "02.06.26" → "2026-06-02". The two-digit year maps to 20YY. Returns
 * null for an incomplete or out-of-range date (the caller treats null as
 * "not a valid date yet").
 */
export const dmyToIso = (dmy: string): string | null => {
  const m = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(dmy.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = 2000 + Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  // Day 0 of (month+1) is the last day of `month` — clamps Feb/30-day months.
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

/**
 * Live input mask: keeps only digits (max 6 = ddmmyy) and re-inserts the
 * dots, so the field reads "dd.mm.yy" while the admin types.
 */
export const maskDmy = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  const parts = [digits.slice(0, 2)];
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 6));
  return parts.filter((p) => p.length > 0).join(".");
};
