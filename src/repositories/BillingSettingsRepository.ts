import {
  apiGetBillingSettings,
  apiUpdateBillingSettings,
  IBillingSettings,
  MoneyRoundingMode,
} from "@/api/joystickPrices";
import { friendlyMutation, orFallback } from "@/api/fallback";

/**
 * A venue's billing policy: what one extra joystick costs, and how the final
 * figure on a bill is rounded.
 *
 * Both are owner-level on the server and both are ONE figure per branch, which
 * is why they share an endpoint. The joystick fee arrived here when the
 * per-slot price list went — three prices for the second, third and fourth pad,
 * which no venue ever set differently.
 *
 * The read falls back rather than throws, the way every other price read here
 * does: a panel pointed at a backend from before this shipped shows a rounding
 * step of 0 and no joystick fee, which is exactly the behaviour that backend
 * has.
 */
export class BillingSettingsRepository {
  async get(branchId: number): Promise<IBillingSettings> {
    return orFallback(apiGetBillingSettings(branchId).then((r) => r.settings), {
      branch_id: branchId,
      money_rounding_step: 0,
      money_rounding_mode: "up" as MoneyRoundingMode,
      joystick_price: null,
      // One included pad is what a backend without this field does, so it is
      // what a panel talking to one has to show.
      joystick_included: 1,
      joystick_charged_slots: null,
    });
  }

  /**
   * The whole policy goes back every time.
   *
   * It is a PUT and the server validates it as one object, so a form that sent
   * only its own half would blank the other's — the rounding form and the
   * joystick form each pass the values they did not change straight through.
   */
  async update(
    branchId: number,
    step: number,
    mode: MoneyRoundingMode,
    joystickPrice: number | null,
    joystickIncluded: number,
    joystickChargedSlots: string | null,
  ): Promise<IBillingSettings> {
    return friendlyMutation(
      apiUpdateBillingSettings(branchId, step, mode, joystickPrice, joystickIncluded, joystickChargedSlots)
        .then((r) => r.settings),
    );
  }
}

export const billingSettingsRepository = new BillingSettingsRepository();
