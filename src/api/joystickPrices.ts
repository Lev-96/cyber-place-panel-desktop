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

/** The three answers the screen offers, and the only ones the server accepts. */
export const CHARGED_SLOT_CHOICES = ["3", "4", "3,4"] as const;
export type ChargedSlots = (typeof CHARGED_SLOT_CHOICES)[number];

/** What the venue has chosen, or null while it has chosen nothing. */
export const chargedSlotsOf = (settings: IBillingSettings): ChargedSlots | null => {
  const raw = settings.joystick_charged_slots;
  return CHARGED_SLOT_CHOICES.includes(raw as ChargedSlots) ? (raw as ChargedSlots) : null;
};

export const apiGetBillingSettings = (branchId: number) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`);

export const apiUpdateBillingSettings = (
  branchId: number,
  step: number,
  mode: MoneyRoundingMode,
  joystickPrice: number | null,
  joystickIncluded: number,
  joystickChargedSlots: string | null,
) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`, {
    method: "PUT",
    // Every field every time: this is a PUT and the server validates the whole
    // policy, so a form that sends only its own half would blank the other's.
    body: {
      money_rounding_step: step,
      money_rounding_mode: mode,
      joystick_price: joystickPrice,
      joystick_included: joystickIncluded,
      joystick_charged_slots: joystickChargedSlots,
    },
  });
