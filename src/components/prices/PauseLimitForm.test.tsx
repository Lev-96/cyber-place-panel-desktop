// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * The owner's pause limit. Like the rounding form it saves through a PUT of
 * the WHOLE policy, so what matters as much as the limit is that every other
 * answer goes back exactly as it was.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import PauseLimitForm from "./PauseLimitForm";

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7, money_rounding_step: 100, money_rounding_mode: "nearest",
  joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff", pause_limit_minutes: null,
  ...over,
});

const mount = async (s: IBillingSettings) => {
  await act(async () => { render(<PauseLimitForm branchId={7} settings={s} onSaved={() => {}} />); });
};
const type = async (v: string) => {
  await act(async () => { fireEvent.change(screen.getByLabelText("pauseLimit.label"), { target: { value: v } }); });
};
const save = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;

beforeEach(() => { repo.update.mockReset(); repo.update.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("the pause limit", () => {
  test("sends the minutes, and every other answer untouched", async () => {
    await mount(settings());
    await type("15");
    await act(async () => { save().click(); });

    expect(sent()).toMatchObject({
      pause_limit_minutes: 15, money_rounding_step: 100, money_rounding_mode: "nearest",
      joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
      joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
    });
  });

  test("an empty box clears the limit", async () => {
    await mount(settings({ pause_limit_minutes: 10 }));
    await type("");
    await act(async () => { save().click(); });

    expect(sent().pause_limit_minutes).toBeNull();
  });

  test.each(["0", "241", "1.5", "ten", "-5"])("%s is refused before any request", async (bad) => {
    await mount(settings());
    await type(bad);

    expect(save().disabled).toBe(true);
    expect(document.body.textContent).toContain("pauseLimit.invalid");
  });

  test("nothing changed, nothing to save", async () => {
    await mount(settings({ pause_limit_minutes: 10 }));
    expect(save().disabled).toBe(true);
  });
});
