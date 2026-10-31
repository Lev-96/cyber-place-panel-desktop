import { IBillingSettings } from "@/api/joystickPrices";
import { applyMinimumCharge } from "@/components/sessions/sessionAmount";
import type { DurationUnit } from "@/components/sessions/durationModel";
import { IMinimumChargeRule } from "@/types/sessions";

/** The server's ceiling (`MinimumChargeRule::MAX_MINUTES`): a day of play. */
export const VIP_MIN_MAX_MINUTES = 1440;

/** Quick picks per unit; any other length can be typed in either unit. */
export const THRESHOLD_PRESETS: Record<DurationUnit, readonly number[]> = {
  minutes: [10, 15, 20, 30],
  hours: [1, 2],
};
export const MINIMUM_PRESETS: Record<DurationUnit, readonly number[]> = {
  minutes: [30, 45, 60, 90],
  hours: [1, 2, 3, 5],
};

/** The rule saved on the branch, or null when it is off or incomplete. */
export const savedRule = (s: IBillingSettings): IMinimumChargeRule | null =>
  s.vip_min_charge_enabled && s.vip_min_charge_after_minutes && s.vip_min_charge_minutes && s.vip_min_charge_mode
    ? { after_minutes: s.vip_min_charge_after_minutes, minimum_minutes: s.vip_min_charge_minutes, mode: s.vip_min_charge_mode }
    : null;

/** A length in minutes as the picker shows it: whole hours in hours, else minutes. */
export const durationFieldOf = (minutes: number): { unit: DurationUnit; amount: string } =>
  minutes >= 60 && minutes % 60 === 0
    ? { unit: "hours", amount: String(minutes / 60) }
    : { unit: "minutes", amount: String(minutes) };

/**
 * What is wrong with a rule, as a translation key, or null.
 *
 * The minimum may not be shorter than the threshold in either mode: from the
 * threshold on more than that has been played, so such a minimum would look
 * switched on and add nothing, and "from 30 min pays at least 15 min" reads
 * as nonsense to an owner. The server refuses it for `minimum`; the panel is
 * stricter so every rule it saves reads as the sentences it shows.
 */
export const ruleProblem = (after: number | null, minimum: number | null): string | null => {
  if (after === null || minimum === null) return "vipMin.invalidDuration";
  if (minimum < after) return "vipMin.minimumBelowThreshold";
  return null;
};

/** "20 мин", "1 ч", "1 ч 30 мин" — in the panel's words. */
export const durationLabel = (minutes: number, t: (k: string) => string): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} ${t("time.minShort")}`;
  return m === 0 ? `${h} ${t("time.hourShort")}` : `${h} ${t("time.hourShort")} ${m} ${t("time.minShort")}`;
};

/** A VIP hourly price the example can be worked at: one per platform. */
export interface VipRateOption {
  slug: string;
  /** "PS5", or a venue's own platform name. */
  label: string;
  rate: number;
  /** How many active VIP seats the branch has on this platform. */
  vipSeats: number;
}

/**
 * The VIP prices this branch has set, one per platform — from the tariff
 * matrix (`<slug>-vip`, pc/ps4/ps5) and from custom-platform price rows —
 * the platforms that actually have VIP seats first (most seats first), so the
 * example is worked at a price the owner's VIP seats really bill. Taking "the
 * first VIP price found" priced it at a PC VIP rate in a branch whose VIP
 * seats are all PS5.
 */
export const vipRateOptions = (
  matrix: Record<string, number | string | null> | null | undefined,
  customPrices: readonly { platform: string; price_vip: number | string | null }[],
  places: readonly { platform: string; type: string; status?: string }[],
  nameOf: (slug: string) => string,
): VipRateOption[] => {
  const rates = new Map<string, number>();
  for (const [key, value] of Object.entries(matrix ?? {})) {
    const rate = Number(value);
    if (key.endsWith("-vip") && rate > 0) rates.set(key.slice(0, -"-vip".length), rate);
  }
  for (const row of customPrices) {
    const rate = Number(row.price_vip);
    if (rate > 0 && !rates.has(row.platform)) rates.set(row.platform, rate);
  }

  const seats = new Map<string, number>();
  for (const place of places) {
    if (place.type === "vip" && place.status !== "inactive") seats.set(place.platform, (seats.get(place.platform) ?? 0) + 1);
  }

  return Array.from(rates, ([slug, rate]) => ({ slug, label: nameOf(slug), rate, vipSeats: seats.get(slug) ?? 0 }))
    .sort((a, b) => b.vipSeats - a.vipSeats);
};

/** Why a visit pays what it pays: the words beside each example. */
export type ExampleReason = "played" | "minimum" | "perMinute" | "roundedUp";

export interface ExampleRow {
  playedMinutes: number;
  billedMinutes: number;
  amount: number;
  reason: ExampleReason;
}

/**
 * What a visit of `playedMinutes` on VIP pays, priced the way the till prices
 * it: `applyMinimumCharge` (the mirror of the backend's `MinimumChargeRule`)
 * on the clock a count-up seat earns at `rate`.
 */
export const exampleRow = (rule: IMinimumChargeRule, rate: number, playedMinutes: number): ExampleRow => {
  const seconds = playedMinutes * 60;
  const clock = Math.round(((rate * seconds) / 3600) * 100) / 100;
  const result = applyMinimumCharge(rule, clock, seconds, rate);
  const billedMinutes = Math.round(result.billedSeconds / 60);
  // Up to the minimum the visit pays the minimum — exactly the minimum played
  // included, though nothing is added there. Past it: by the minute, or rounded.
  const reason: ExampleReason = playedMinutes < rule.after_minutes
    ? "played"
    : playedMinutes <= rule.minimum_minutes
      ? "minimum"
      : rule.mode === "round_up" ? "roundedUp" : "perMinute";
  return { playedMinutes, billedMinutes, amount: result.amount, reason };
};

/** The telling moments of a rule: just under the threshold, at it, at the minimum, past it. */
export const exampleMinutes = (rule: IMinimumChargeRule): number[] => {
  const a = rule.after_minutes;
  const m = rule.minimum_minutes;
  const points = [a - 1, a, m, m + 10];
  return Array.from(new Set(points.filter((p) => p >= 1 && p <= VIP_MIN_MAX_MINUTES))).sort((x, y) => x - y);
};

/**
 * A visit moved between two VIP seats: the two stretches and what the whole
 * visit pays. Chosen so neither stretch reaches the threshold alone while the
 * two together do (when the threshold allows it) — the case an owner worries
 * about: a move neither resets the threshold nor charges the minimum twice.
 */
export const moveExample = (rule: IMinimumChargeRule, rate: number): ExampleRow & { first: number; second: number } => {
  const total = Math.min(rule.after_minutes + 10, VIP_MIN_MAX_MINUTES);
  const first = Math.ceil(total / 2);
  return { first, second: total - first, ...exampleRow(rule, rate, total) };
};
