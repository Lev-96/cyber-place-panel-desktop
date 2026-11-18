/**
 * Project-wide date formatting. Locale-independent: same `DD.MM.YYYY HH:mm`
 * shape regardless of `lang`, so every screen reads the same way and a
 * language switch never reflows widths.
 *
 * Always rendered in the user's wall-clock TZ (the JS Date does the lift).
 * If the input is null/undefined/invalid, returns the placeholder ("-").
 */

type DateLike = string | number | Date | null | undefined;

const PLACEHOLDER = "-";
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

/** The venue's clock: every Cyber Place branch is in Armenia. */
export const VENUE_TIME_ZONE = "Asia/Yerevan";

const venueFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/**
 * "01.05.2026 23:55" on the VENUE's clock (Asia/Yerevan), whatever the
 * machine's own zone — for audit rows an owner may read from abroad, where
 * the machine-local {@link formatDateTime} would shift every entry.
 */
export const formatVenueDateTime = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  const parts = venueFormat.formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}.${part("year")} ${part("hour")}:${part("minute")}`;
};

/**
 * The venue's calendar (Asia/Yerevan) for the money screens (2026-11-18,
 * owner): a day or a month counted there must not move with the machine's
 * own zone. Armenia keeps +04:00 all year (no daylight saving).
 */
export const VENUE_UTC_OFFSET = "+04:00";

const venueDayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: VENUE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const venueTimeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: VENUE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The venue's date of an instant, "YYYY-MM-DD". */
export const venueDateInput = (input: DateLike = new Date()): string => {
  const d = toDate(input) ?? new Date();
  const parts = venueDayFormat.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

/** "01.05.2026" on the venue's clock. */
export const formatVenueDate = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  const [y, m, day] = venueDateInput(d).split("-");
  return `${day}.${m}.${y}`;
};

/** "23:55" on the venue's clock. */
export const formatVenueTime = (input: DateLike): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return venueTimeFormat.format(d);
};

/** A venue calendar month as instants: its first 00:00 to its last 23:59:59.999, Yerevan. */
export const venueMonthBoundsIso = (year: number, month: number): { from: string; to: string } => {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: new Date(`${year}-${mm}-01T00:00:00.000${VENUE_UTC_OFFSET}`).toISOString(),
    to: new Date(`${year}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999${VENUE_UTC_OFFSET}`).toISOString(),
  };
};

