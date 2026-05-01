/**
 * Project-wide date formatting. Locale-independent: same `DD.MM.YYYY HH:mm`
 * shape regardless of `lang`, so every screen reads the same way and a
 * language switch never reflows widths.
 *
 * Always rendered in the user's wall-clock TZ (the JS Date does the lift).
 * If the input is null/undefined/invalid, returns the placeholder ("—").
 */

type DateLike = string | number | Date | null | undefined;

const PLACEHOLDER = "—";
const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

const toDate = (input: DateLike): Date | null => {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "01.05.2026" */
export const formatDate = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/** "23:55" */
export const formatTime = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "01.05.2026 23:55" */
export const formatDateTime = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return `${formatDate(d)} ${formatTime(d)}`;
};

/** "May 2026" → not localized; uses month number for stable layout. "05.2026" */
export const formatMonth = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return `${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
