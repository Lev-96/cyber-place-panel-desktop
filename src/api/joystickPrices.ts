import { request } from "./client";

/**
 * What one extra joystick costs, and the venue's rounding policy.
 *
 * ## One fee, not one per slot
 *
 * It was three prices — the second pad, the third and the fourth — and no
 * venue ever set them differently, so the screen asked an operator three
 * questions with a single answer. There is now ONE figure per branch, and it
 * lives on the branch's billing settings beside the rounding rule: both are
 * owner-level policy about money, and neither is worth a table.
 *
 * The fee is FIXED per use. A player who takes a pad is charged it the moment
 * the pad leaves the counter — not per hour, not after a wait — and charged it
 * back off if they hand the pad in. Nothing on this side computes any of that;
 * the server owns the figure and the panel shows what it returns.
 *
 * `null` is a VALUE and not a missing field: it means the venue does not offer
 * extra pads, and the server refuses the add with a sentence pointing here.
 *
 * READING is open to every staff role — the "+" button on a session card has
 * to know a fee exists before it offers to add a pad. WRITING is owner-level
 * and the backend enforces it (`prices.manage`); the permission map here only
 * decides whether the form is drawn.
 */

/** Pads one PlayStation session may hold in total, its own included. */
export const MAX_JOYSTICKS = 4;

/* ── the venue's money-rounding policy ─────────────────────────────────── */

export type MoneyRoundingMode = "up" | "nearest" | "down";

export interface IBillingSettings {
  branch_id: number;
  /** 0 = round nothing. The default every branch is on. */
  money_rounding_step: number;
  money_rounding_mode: MoneyRoundingMode;
  /**
   * The flat fee for ONE extra joystick, the same for every slot.
   *
   * `null` means extra pads are not offered here — a decision, not a gap, and
   * the server refuses the add when it is set.
   */
  joystick_price: number | null;
  /**
   * How many pads this venue's hourly rate already pays for, the session's own
   * controller always among them.
   *
   * This is the half venues differ on: one sells a seat with a single
   * controller and charges for every other, another quotes a room with four
   * and charges for none. 1 is the floor, because a PlayStation session with
   * no controller is not a thing anybody sells, and `joystick_max` is the top.
   *
   * Optional on the wire only so a panel talking to a backend from before this
   * shipped still reads; the repository fills in 1, which is exactly what that
   * backend does.
   */
  joystick_included?: number;
  /**
   * WHICH extra pads this venue charges for: "3", "4" or "3,4".
   *
   * Null means the venue has not answered, and the count above decides, which
   * is what every branch is on until somebody opens the screen. A count can
   * only ever say "everything above N"; this can say "the third and not the
   * fourth", which is the rule an operator asked to be able to name.
   */
  joystick_charged_slots?: string | null;
  /**
   * HOW a pad is priced here.
   *
   * "fixed" is a fee owed the moment the pad is handed out, and handing it
   * back does not give it back. "hourly" prices the pad like the seat: the
   * hour costs more while it is out, and costs what it did before once it is
   * returned. Absent on an older backend, which only ever had the fee.
   */
  joystick_pricing_mode?: JoystickPricingMode;
  /**
   * The FOURTH pad's own fee, when this venue prices it apart from the third.
   *
   * `null` is not "free" and not "missing": it is "the fourth is priced like
   * the third", which is what every venue did before the two could differ and
   * what the "3/4" answer on the Prices screen means. A figure here is the
   * venue saying the two are separate decisions, even when the two figures
   * happen to be equal today.
   */
  joystick_price_4?: number | null;
  /**
   * The highest slot this venue hands out at all.
   *
   * Different from the allowance above, and the difference is the point:
   * `joystick_included` says how many pads are FREE, this says how many EXIST.
   * A venue that hands out three controllers and never a fourth sets this to 3,
   * and the fourth stops being offered rather than merely being free.
   */
  joystick_max_slot?: number;
  /**
   * The ceiling a seat may hold, as the SERVER states it.
   *
   * `MAX_JOYSTICKS` above is this panel's own copy of the same number and is
   * still what the board draws with. Server-provided is the one to prefer
   * wherever a new screen needs it: a constant on this side is a second answer
   * to a question only the server can settle.
   */
  joystick_max?: number;
}

/**
 * The venue's allowance, with the older backend's answer filled in.
 *
 * One included pad is exactly what a backend without the field does, so a
 * panel talking to one must show the same thing. Lives here rather than in the
 * forms so the two that write this policy cannot disagree about the default.
 */
export const includedJoysticks = (settings: IBillingSettings): number =>
  settings.joystick_included ?? 1;

/** The two ways a venue can price a pad, and the only ones the server accepts. */
export const PRICING_MODES = ["fixed", "hourly"] as const;
export type JoystickPricingMode = (typeof PRICING_MODES)[number];

/** What the venue charges by, with the older backend's answer filled in. */
export const pricingModeOf = (settings: IBillingSettings): JoystickPricingMode =>
  settings.joystick_pricing_mode === "hourly" ? "hourly" : "fixed";

/** The three answers the screen offers, and the only ones the server accepts. */
export const CHARGED_SLOT_CHOICES = ["3", "4", "3,4"] as const;
export type ChargedSlots = (typeof CHARGED_SLOT_CHOICES)[number];

/** What the venue has chosen, or null while it has chosen nothing. */
export const chargedSlotsOf = (settings: IBillingSettings): ChargedSlots | null => {
  const raw = settings.joystick_charged_slots;
  return CHARGED_SLOT_CHOICES.includes(raw as ChargedSlots) ? (raw as ChargedSlots) : null;
};

/**
 * The three shapes a venue's extra pads can take, read off the stored pair.
 *
 * One function rather than the same two comparisons on three screens: "does
 * this venue price the fourth pad apart" is a question about the configuration
 * and it must have exactly one answer, or the Prices form and the session card
 * will eventually disagree about what the owner chose.
 */
export type JoystickSetup = "only3" | "separate" | "shared";

export const maxJoystickSlotOf = (settings: IBillingSettings): number =>
  settings.joystick_max_slot ?? MAX_JOYSTICKS;

export const joystickSetupOf = (settings: IBillingSettings): JoystickSetup => {
  if (maxJoystickSlotOf(settings) <= 3) return "only3";

  return settings.joystick_price_4 !== null && settings.joystick_price_4 !== undefined
    ? "separate"
    : "shared";
};

/**
 * The whole venue policy, as one object rather than a row of positional
 * arguments.
 *
 * It was seven positional parameters and the seventh had just been added. Six
 * of them are `number | null`, they are all about money, and the compiler
 * cannot tell one from another — which is the shape a wrong bill ships in.
 * Named fields make a miswritten call a type error instead of a silent
 * reordering of somebody's prices.
 */
export interface IBillingPolicy {
  money_rounding_step: number;
  money_rounding_mode: MoneyRoundingMode;
  joystick_price: number | null;
  joystick_included: number;
  joystick_charged_slots: string | null;
  joystick_pricing_mode: JoystickPricingMode;
  joystick_price_4: number | null;
  joystick_max_slot: number;
}

export const apiGetBillingSettings = (branchId: number) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`);

export const apiUpdateBillingSettings = (branchId: number, policy: IBillingPolicy) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`, {
    method: "PUT",
    // Every field every time: this is a PUT and the server validates the whole
    // policy, so a form that sends only its own half would blank the other's.
    body: { ...policy },
  });
