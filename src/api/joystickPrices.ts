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
}

export const apiGetBillingSettings = (branchId: number) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`);

export const apiUpdateBillingSettings = (
  branchId: number,
  step: number,
  mode: MoneyRoundingMode,
  joystickPrice: number | null,
) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`, {
    method: "PUT",
    // Every field every time: this is a PUT and the server validates the whole
    // policy, so a form that sends only its own half would blank the other's.
    body: {
      money_rounding_step: step,
      money_rounding_mode: mode,
      joystick_price: joystickPrice,
    },
  });
