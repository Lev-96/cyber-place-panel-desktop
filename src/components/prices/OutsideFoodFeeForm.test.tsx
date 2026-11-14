// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * «Свои продукты» on the branch's Prices page (2026-11-13, owner): the fixed
 * fee for a player who brings their own food, one figure for standard seats
 * and one for VIP. Saved through the PUT of the WHOLE policy like every rule on
 * that page, so every other answer must go back exactly as it was. Empty is
 * "not charged" (null); 0 is refused here, as the server refuses it.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "ru", currency: "AMD" }),
}));

import OutsideFoodFeeForm from "./OutsideFoodFeeForm";

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7, money_rounding_step: 100, money_rounding_mode: "nearest",
  joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff", pause_limit_minutes: 30,
  outside_food_fee_standard: null, outside_food_fee_vip: null,
  ...over,
});

const mount = async (s: IBillingSettings) => {
  await act(async () => { render(
    <OutsideFoodFeeForm branchId={7} settings={s} places={[]} placesError={null} onRetryPlaces={() => {}} platformName={(p) => p} onSaved={() => {}} />,
  ); });
};
const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const standard = () => box("outsideFood.standard");
const vip = () => box("outsideFood.vip");
const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => { fireEvent.change(input, { target: { value } }); });
};
const save = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;

beforeEach(() => { repo.update.mockReset(); repo.update.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("the own-food fee", () => {
  test("both tiers sent, and every other answer of the policy exactly as it was", async () => {
    await mount(settings());
    await type(standard(), "1500");
    await type(vip(), "2500");
    await act(async () => { save().click(); });

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update.mock.calls[0][0]).toBe(7);
    expect(sent()).toEqual({
      money_rounding_step: 100, money_rounding_mode: "nearest",
      joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
      joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
      joystick_strategy_mode: "change_tariff",
      outside_food_fee_standard: 1500, outside_food_fee_vip: 2500,
    });
  });

  test("an empty box is «not charged»: null, and said under the box", async () => {
    await mount(settings({ outside_food_fee_standard: 1000, outside_food_fee_vip: 2000 }));
    expect(standard().value).toBe("1000");
    expect(screen.queryAllByText("outsideFood.notCharged")).toHaveLength(0);
    await type(vip(), "");
    expect(screen.getAllByText("outsideFood.notCharged")).toHaveLength(1);
    await act(async () => { save().click(); });
    expect(sent()).toMatchObject({ outside_food_fee_standard: 1000, outside_food_fee_vip: null });
  });

  test("0 is refused before any request, with a sentence saying why", async () => {
    await mount(settings());
    await type(standard(), "0");
    expect(save().disabled).toBe(true);
    expect(screen.getByText("outsideFood.zeroRefused")).toBeTruthy();
    await act(async () => { fireEvent.submit(save().closest("form")!); });
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("nothing changed, nothing to save", async () => {
    await mount(settings({ outside_food_fee_standard: 1500, outside_food_fee_vip: null }));
    expect(save().disabled).toBe(true);
    await type(standard(), "1500");
    expect(save().disabled).toBe(true);
  });

  test("an older backend (no fields): both boxes empty, read as not charged", async () => {
    const s = settings();
    delete s.outside_food_fee_standard;
    delete s.outside_food_fee_vip;
    await mount(s);
    expect([standard().value, vip().value]).toEqual(["", ""]);
    expect(screen.getAllByText("outsideFood.notCharged")).toHaveLength(2);
  });
});
