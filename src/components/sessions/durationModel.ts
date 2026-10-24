/**
 * A length of time typed or picked in hours OR minutes, and read as minutes.
 *
 * One model for "+ Время" and for a planned start (2026-10-25), so the two
 * forms cannot disagree about what "1.5" means. The value is ONE string plus
 * ONE unit: there is never a minutes box and an hours box that could both be
 * filled, which is how the same number gets read twice.
 *
 * Nothing here prices anything — the price is the server's (`time-quote`,
 * `start-quote`).
 */
export type DurationUnit = "hours" | "minutes";

/** The server's ceiling for one grant or plan (`SessionTimeService::MAX_MINUTES`). */
export const MAX_DURATION_MINUTES = 600;

export const HOUR_PRESETS = [1, 2, 3, 4, 5] as const;
export const MINUTE_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120, 180] as const;

export const presetsOf = (unit: DurationUnit): readonly number[] =>
  unit === "hours" ? HOUR_PRESETS : MINUTE_PRESETS;

/**
 * The minutes a typed amount means, or null when it means none the server
 * would accept: empty, not a number, not a whole number of minutes, or
 * outside 1…600. "1,5" is accepted as 1.5 — a decimal comma is how half the
 * floor types it.
 */
export const minutesOf = (amount: string, unit: DurationUnit): number | null => {
  const raw = amount.trim().replace(",", ".");
  if (raw === "") return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  const minutes = unit === "hours" ? value * 60 : value;
  // 0.1 h is 6 min; 0.33 h is not a whole minute and is refused rather than
  // rounded behind the cashier's back.
  const whole = Math.round(minutes);
  if (Math.abs(minutes - whole) > 1e-9) return null;

  return whole >= 1 && whole <= MAX_DURATION_MINUTES ? whole : null;
};

/**
 * The same length written in the other unit, so switching hours ↔ minutes
 * keeps what was chosen instead of re-reading "2" as two minutes. A value
 * that means nothing yet is kept as typed.
 */
export const amountIn = (amount: string, from: DurationUnit, to: DurationUnit): string => {
  if (from === to) return amount;
  const minutes = minutesOf(amount, from);
  if (minutes === null) return amount;
  if (to === "minutes") return String(minutes);

  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
};
