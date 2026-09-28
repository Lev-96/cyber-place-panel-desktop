// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * The rounding form, and the joystick settings it carries past.
 *
 * This form edits two numbers. It is here because of what it does with the
 * REST of the branch's billing policy: the endpoint behind it is a PUT of the
 * whole thing, so a save that sent only the rounding half would clear the
 * venue's joystick fee, reset its allowance and put the fourth pad back on a
 * shared price — silently, from a screen an operator opened to change how a
 * total is rounded.
 *
 * That was always true. It matters more now: the venue-wide joystick screen is
 * gone, so this is the only thing in the panel that writes those columns at
 * all, and nothing else would notice if it started dropping them.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import MoneyRoundingForm from "./MoneyRoundingForm";

/** A venue with every joystick answer set to something non-default. */
const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7,
  money_rounding_step: 0,
  money_rounding_mode: "up",
  joystick_price: 500,
  joystick_included: 2,
  joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly",
  joystick_price_4: 700,
  joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff",
  ...over,
});

const mount = async (s: IBillingSettings) => {
  await act(async () => {
    render(<MoneyRoundingForm branchId={7} settings={s} onSaved={() => {}} />);
  });
};

/** Change the step, which is what makes the form savable at all. */
const saveWithStep = async (step: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("rounding.step"), { target: { value: step } });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "action.save" }));
  });
};

const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;

beforeEach(() => { repo.update.mockReset(); repo.update.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("saving a rounding policy", () => {
  test("sends the new rounding", async () => {
    await mount(settings());
    await saveWithStep("100");

    expect(sent().money_rounding_step).toBe(100);
    expect(sent().money_rounding_mode).toBe("up");
  });

  test("and carries every joystick answer back untouched", async () => {
    await mount(settings());
    await saveWithStep("100");

    const body = sent();
    expect(body.joystick_price).toBe(500);
    expect(body.joystick_included).toBe(2);
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_pricing_mode).toBe("hourly");
    expect(body.joystick_price_4).toBe(700);
    expect(body.joystick_max_slot).toBe(4);
  });

  /**
   * The retired three-way answer is the one field that cannot go back
   * verbatim: nothing may write it any more, and a PUT carrying it would be
   * refused. What goes back is the single answer the server already resolves
   * it to, so the venue's bills do not move.
   */
  test("a branch still on the retired 'both' is sent the answer it resolves to", async () => {
    await mount(settings({ joystick_strategy_mode: "both" as never, joystick_pricing_mode: "hourly" }));
    await saveWithStep("50");

    expect(sent().joystick_strategy_mode).toBe("change_tariff");
  });

  test("…and a fee venue on 'both' resolves the other way", async () => {
    await mount(settings({ joystick_strategy_mode: "both" as never, joystick_pricing_mode: "fixed" }));
    await saveWithStep("50");

    expect(sent().joystick_strategy_mode).toBe("fixed_price");
  });

  /**
   * The room's charge mode is NOT this endpoint's business and must not be
   * invented here: the place owns it, and a value sent from this screen could
   * only ever be a guess.
   */
  test("never sends a charge mode, which belongs to the room", async () => {
    await mount(settings());
    await saveWithStep("100");

    expect(sent()).not.toHaveProperty("joystick_charge_mode");
  });

  /** A venue that offers no extra pads keeps offering none. */
  test("a null fee stays null rather than becoming a free pad", async () => {
    await mount(settings({ joystick_price: null }));
    await saveWithStep("10");

    expect(sent().joystick_price).toBeNull();
  });
});
