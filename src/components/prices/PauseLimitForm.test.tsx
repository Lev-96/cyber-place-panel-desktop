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
const hours = () => screen.getByTestId("pause-limit-hours") as HTMLInputElement;
const minutes = () => screen.getByTestId("pause-limit-minutes") as HTMLInputElement;
const type = async (h: string, m: string) => {
  await act(async () => { fireEvent.change(hours(), { target: { value: h } }); });
  await act(async () => { fireEvent.change(minutes(), { target: { value: m } }); });
};
const leave = async () => { await act(async () => { fireEvent.focusOut(minutes(), { relatedTarget: null }); }); };
const save = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;

beforeEach(() => { repo.update.mockReset(); repo.update.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("the pause limit", () => {
  test("the start dialog's time field: hours and minutes, sent as minutes, every other answer untouched", async () => {
    await mount(settings());
    await type("1", "30");
    await act(async () => { save().click(); });

    expect(sent()).toMatchObject({
      pause_limit_minutes: 90, money_rounding_step: 100, money_rounding_mode: "nearest",
      joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
      joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
    });
  });

  test("minutes alone", async () => {
    await mount(settings());
    await type("", "15");
    await act(async () => { save().click(); });
    expect(sent().pause_limit_minutes).toBe(15);
  });

  test("a saved limit opens in hours and minutes", async () => {
    await mount(settings({ pause_limit_minutes: 75 }));
    expect([hours().value, minutes().value]).toEqual(["1", "15"]);
    expect(save().disabled).toBe(true);
  });

  test("both boxes empty clears the limit, and says so", async () => {
    await mount(settings({ pause_limit_minutes: 10 }));
    await type("", "");
    expect(screen.getByTestId("pause-limit-none").textContent).toBe("pauseLimit.none");
    await act(async () => { save().click(); });

    expect(sent().pause_limit_minutes).toBeNull();
  });

  test.each([["0", "00"], ["4", "01"], ["5", "00"]])("%s h %s min is refused before any request", async (h, m) => {
    await mount(settings());
    await type(h, m);
    await leave();

    expect(save().disabled).toBe(true);
    expect(document.body.textContent).toContain("pauseLimit.invalid");
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("exactly the ceiling, 4 h, is accepted", async () => {
    await mount(settings());
    await type("4", "00");
    await act(async () => { save().click(); });
    expect(sent().pause_limit_minutes).toBe(240);
  });

  test("nothing changed, nothing to save", async () => {
    await mount(settings({ pause_limit_minutes: 10 }));
    expect(save().disabled).toBe(true);
  });
});
