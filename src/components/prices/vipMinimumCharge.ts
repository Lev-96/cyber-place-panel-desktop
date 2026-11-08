import { IBillingSettings } from "@/api/joystickPrices";
import { applyMinimumCharge } from "@/components/sessions/sessionAmount";
import { IMinimumChargeRule } from "@/types/sessions";

/** The server's ceiling (`MinimumChargeRule::MAX_MINUTES`): a day of play. */
export const VIP_MIN_MAX_MINUTES = 1440;

/**
 * Which seats the rule covers (2026-11-06; the server's `MinimumChargeScope`).
 * A branch that never chose reads as `vip`, the rule every branch had before.
 */
export type MinimumChargeScope = "all" | "vip" | "standard" | "places";
export const MINIMUM_CHARGE_SCOPES: readonly MinimumChargeScope[] = ["all", "vip", "standard", "places"];

export const scopeOf = (s: IBillingSettings): MinimumChargeScope =>
  MINIMUM_CHARGE_SCOPES.includes(s.vip_min_charge_scope as MinimumChargeScope)
    ? (s.vip_min_charge_scope as MinimumChargeScope)
    : "vip";

export const placeIdsOf = (s: IBillingSettings): number[] =>
  Array.isArray(s.vip_min_charge_place_ids) ? s.vip_min_charge_place_ids.filter((id) => Number.isInteger(id) && id > 0) : [];

/** A seat's price tier, as the tariff matrix names it. */
export type SeatTier = "vip" | "standard";
const tierOf = (type: string): SeatTier => (type === "vip" ? "vip" : "standard");

/** The tiers the rule reaches under `scope` — the prices its example may be worked at. */
export const tiersOf = (
  scope: MinimumChargeScope,
  places: readonly { id: number; type: string }[],
  placeIds: readonly number[],
): SeatTier[] => {
  if (scope === "vip") return ["vip"];
  if (scope === "standard") return ["standard"];
  if (scope === "all") return ["vip", "standard"];
  const chosen = new Set(placeIds);
  return (["vip", "standard"] as const).filter((tier) => places.some((p) => chosen.has(p.id) && tierOf(p.type) === tier));
};

/** The rule saved on the branch, or null when it is off or incomplete. */
export const savedRule = (s: IBillingSettings): IMinimumChargeRule | null =>
  s.vip_min_charge_enabled && s.vip_min_charge_after_minutes && s.vip_min_charge_minutes && s.vip_min_charge_mode
    ? { after_minutes: s.vip_min_charge_after_minutes, minimum_minutes: s.vip_min_charge_minutes, mode: s.vip_min_charge_mode }
    : null;

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

export { durationLabel } from "@/utils/durationLabel";

/** An hourly price the example can be worked at: one per platform and tier. */
export interface RateOption {
  /** `<platform>-<tier>`, unique among the options. */
  key: string;
  slug: string;
  tier: SeatTier;
  /** "PS5", or a venue's own platform name. */
  label: string;
  rate: number;
  /** How many active seats of this platform and tier the branch has. */
  seats: number;
}

/**
 * The prices this branch has set for the tiers the rule reaches, one per
 * platform and tier — from the tariff matrix (`<slug>-vip`, `<slug>-standard`)
 * and from custom-platform price rows — the ones that actually have seats
 * first (most seats first), so the example is worked at a price the owner's
 * seats really bill. Taking "the first price found" priced it at a PC rate in
 * a branch whose seats are all PS5.
 */
export const rateOptions = (
  matrix: Record<string, number | string | null> | null | undefined,
  customPrices: readonly { platform: string; price_vip?: number | string | null; price_standard?: number | string | null }[],
  places: readonly { platform: string; type: string; status?: string }[],
  nameOf: (slug: string) => string,
  tiers: readonly SeatTier[] = ["vip"],
): RateOption[] => {
  const rates = new Map<string, { slug: string; tier: SeatTier; rate: number }>();
  for (const tier of tiers) {
    const suffix = `-${tier}`;
    for (const [key, value] of Object.entries(matrix ?? {})) {
      const rate = Number(value);
      if (key.endsWith(suffix) && rate > 0) {
        const slug = key.slice(0, -suffix.length);
        rates.set(`${slug}${suffix}`, { slug, tier, rate });
      }
    }
    for (const row of customPrices) {
      const rate = Number(tier === "vip" ? row.price_vip : row.price_standard);
      const key = `${row.platform}${suffix}`;
      if (rate > 0 && !rates.has(key)) rates.set(key, { slug: row.platform, tier, rate });
    }
  }

  const seats = new Map<string, number>();
  for (const place of places) {
    if (place.status === "inactive") continue;
    const key = `${place.platform}-${tierOf(place.type)}`;
    seats.set(key, (seats.get(key) ?? 0) + 1);
  }

  return Array.from(rates, ([key, o]) => ({ key, slug: o.slug, tier: o.tier, label: nameOf(o.slug), rate: o.rate, seats: seats.get(key) ?? 0 }))
    .sort((a, b) => b.seats - a.seats);
};

/** Why a visit pays what it pays: the words beside each example. */
export type ExampleReason = "played" | "minimum" | "perMinute";

export interface ExampleRow {
  playedMinutes: number;
  billedMinutes: number;
  amount: number;
  reason: ExampleReason;
}

/**
 * What a visit of `playedMinutes` on a covered seat pays, priced the way the till prices
 * it: `applyMinimumCharge` (the mirror of the backend's `MinimumChargeRule`)
 * on the clock a count-up seat earns at `rate`.
 */
export const exampleRow = (rule: IMinimumChargeRule, rate: number, playedMinutes: number): ExampleRow => {
  const seconds = playedMinutes * 60;
  const clock = Math.round(((rate * seconds) / 3600) * 100) / 100;
  const result = applyMinimumCharge(rule, clock, seconds, rate);
  const billedMinutes = Math.round(result.billedSeconds / 60);
  // Up to the minimum the visit pays the minimum — exactly the minimum played
  // included, though nothing is added there. Past it: by the minute (the one
  // way since 2026-11-06).
  const reason: ExampleReason = playedMinutes < rule.after_minutes
    ? "played"
    : playedMinutes <= rule.minimum_minutes
      ? "minimum"
      : "perMinute";
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
 * A visit moved between two covered seats: the two stretches and what the whole
 * visit pays. Chosen so neither stretch reaches the threshold alone while the
 * two together do (when the threshold allows it) — the case an owner worries
 * about: a move neither resets the threshold nor charges the minimum twice.
 */
export const moveExample = (rule: IMinimumChargeRule, rate: number): ExampleRow & { first: number; second: number } => {
  const total = Math.min(rule.after_minutes + 10, VIP_MIN_MAX_MINUTES);
  const first = Math.ceil(total / 2);
  return { first, second: total - first, ...exampleRow(rule, rate, total) };
};
