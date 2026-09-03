import {
  apiDeleteJoystickPrice,
  apiGetBillingSettings,
  apiListJoystickPrices,
  apiSaveJoystickPrice,
  apiUpdateBillingSettings,
  apiUpdateJoystickPrice,
  IBillingSettings,
  IJoystickPrice,
  MoneyRoundingMode,
} from "@/api/joystickPrices";
import { friendlyMutation, orFallback } from "@/api/fallback";

/**
 * Joystick prices and the venue's money-rounding policy — the two things the
 * Prices screen gained, both owner-level on the server.
 *
 * Reads fall back rather than throw, the way every other price read here does:
 * a panel pointed at a backend from before this shipped shows no joystick
 * section and a rounding step of 0, which is exactly the behaviour that
 * backend has.
 */
export class JoystickPriceRepository {
  async listByBranch(branchId: number): Promise<IJoystickPrice[]> {
    return orFallback(apiListJoystickPrices(branchId).then((r) => r.data), []);
  }

  async save(branchId: number, slot: number, pricePerHour: number): Promise<IJoystickPrice> {
    return friendlyMutation(apiSaveJoystickPrice(branchId, slot, pricePerHour).then((r) => r.data));
  }

  async update(id: number, pricePerHour: number): Promise<IJoystickPrice> {
    return friendlyMutation(apiUpdateJoystickPrice(id, pricePerHour).then((r) => r.data));
  }

  async remove(id: number): Promise<void> {
    await friendlyMutation(apiDeleteJoystickPrice(id));
  }

  async billingSettings(branchId: number): Promise<IBillingSettings> {
    return orFallback(apiGetBillingSettings(branchId).then((r) => r.settings), {
      branch_id: branchId,
      money_rounding_step: 0,
      money_rounding_mode: "up" as MoneyRoundingMode,
    });
  }

  async saveBillingSettings(
    branchId: number,
    step: number,
    mode: MoneyRoundingMode,
  ): Promise<IBillingSettings> {
    return friendlyMutation(apiUpdateBillingSettings(branchId, step, mode).then((r) => r.settings));
  }
}

export const joystickPriceRepository = new JoystickPriceRepository();
