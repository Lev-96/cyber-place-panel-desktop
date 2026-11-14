/**
 * Wall-clock times of day as the backend takes them: "HH:MM", 24-hour.
 *
 * The backend validates every time-of-day field with `date_format:H:i`, but a
 * MySQL `TIME` column reads back as "HH:MM:SS". A form that preloads a stored
 * value has to trim it before it can send it again (the working-hours form
 * did not, and every save of a branch's hours was refused with 14 errors).
 */

/** A complete, valid 24-hour "HH:MM" (00:00..23:59). */
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The same, with optional seconds: what a `TIME` column reads back as. */
const STORED_TIME_RE = /^(([01]\d|2[0-3]):[0-5]\d)(:[0-5]\d)?$/;

/**
 * "10:00:00" → "10:00", "10:00" → "10:00". Anything that is not exactly one of
 * those two shapes ("9:00", "24:00", "10:00:00.000", null) is null, so the
 * caller decides what a broken value falls back to instead of sending it on.
 */
export const toHHMM = (value: string | null | undefined): string | null => {
  const m = typeof value === "string" ? STORED_TIME_RE.exec(value.trim()) : null;
  return m ? m[1] : null;
};

/** Minutes since midnight of a valid "HH:MM" ("02:40" → 160). */
export const minutesOfDay = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
