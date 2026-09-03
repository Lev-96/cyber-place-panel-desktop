import { request } from "./client";

/**
 * Per-hour prices for the 2nd, 3rd and 4th joystick on a PlayStation session.
 *
 * There is no price for the first: that pad is the session, and it is already
 * paid for by the place's own hourly rate. Slots are priced separately because
 * a venue may well charge less for the second than for the fourth, which a
 * single "extra pad" figure could not express.
 *
 * READING is open to every staff role — the "+ joystick" button on a session
 * card has to know whether a price exists before it offers to add one. WRITING
 * is owner-level and the backend enforces it (`prices.manage`); the permission
 * map here only decides whether the form is drawn.
 */

/** The slots a venue can price. Mirrors `BranchJoystickPrice::SLOTS`. */
export const JOYSTICK_SLOTS = [2, 3, 4] as const;

/** Pads one PlayStation session may have in total, its own included. */
export const MAX_JOYSTICKS = 4;

export interface IJoystickPrice {
  id: number;
  branch_id: number;
  slot: number;
  price_per_hour: number;
}

export const apiListJoystickPrices = (branchId: number) =>
  request<{ data: IJoystickPrice[] }>("/branch-joystick-prices", { params: { branch_id: branchId } });

/**
 * Create or re-price a slot. The backend upserts on (branch, slot), so filling
 * a cell twice is not a duplicate — it is the operator changing their mind,
 * which is what the form does.
 */
export const apiSaveJoystickPrice = (branchId: number, slot: number, pricePerHour: number) =>
  request<{ data: IJoystickPrice }>("/branch-joystick-prices", {
    method: "POST",
    body: { branch_id: branchId, slot, price_per_hour: pricePerHour },
  });

export const apiUpdateJoystickPrice = (id: number, pricePerHour: number) =>
  request<{ data: IJoystickPrice }>(`/branch-joystick-prices/${id}`, {
    method: "PUT",
    body: { price_per_hour: pricePerHour },
  });

/**
 * Remove a slot's price. Sessions using that slot right now are untouched —
 * their rate is frozen onto their own rows — it simply stops new pads being
 * added there, which is what "we do not offer that" means.
 */
export const apiDeleteJoystickPrice = (id: number) =>
  request<{ message: string }>(`/branch-joystick-prices/${id}`, { method: "DELETE" });

/* ── the venue's money-rounding policy ─────────────────────────────────── */

export type MoneyRoundingMode = "up" | "nearest" | "down";

export interface IBillingSettings {
  branch_id: number;
  /** 0 = round nothing. The default every branch is on. */
  money_rounding_step: number;
  money_rounding_mode: MoneyRoundingMode;
}

export const apiGetBillingSettings = (branchId: number) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`);

export const apiUpdateBillingSettings = (
  branchId: number,
  step: number,
  mode: MoneyRoundingMode,
) =>
  request<{ settings: IBillingSettings }>(`/branches/${branchId}/billing-settings`, {
    method: "PUT",
    body: { money_rounding_step: step, money_rounding_mode: mode },
  });
