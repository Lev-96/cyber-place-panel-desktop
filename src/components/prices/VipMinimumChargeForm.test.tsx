// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * The owner's minimum charge (2026-11-06: any seats, by the minute past the
 * minimum), read the way an owner reads it — in the real Russian copy, so what
 * is asserted is the sentence on screen, not a key.
 *
 * Saved through a PUT of the policy like every money rule here, so every other
 * answer must go back exactly as it was; lengths are the start dialog's time
 * field and always saved as minutes; the example table must show what the
 * till would charge (the backend pins the same figures) and why.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", async () => {
  const real = await vi.importActual<typeof import("@/i18n/translations")>("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => real.t(k, "ru"), money: (n: number) => `${n}·AMD`, lang: "ru" }) };
});

import VipMinimumChargeForm, { type MinimumChargeSeat } from "./VipMinimumChargeForm";
import { rateOptions, type SeatTier } from "./vipMinimumCharge";

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7, money_rounding_step: 100, money_rounding_mode: "nearest",
  joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff", pause_limit_minutes: 10,
  vip_min_charge_enabled: false, vip_min_charge_after_minutes: null, vip_min_charge_minutes: null, vip_min_charge_mode: null,
  ...over,
});
const on = (over: Partial<IBillingSettings> = {}) => settings({
  vip_min_charge_enabled: true, vip_min_charge_after_minutes: 20, vip_min_charge_minutes: 60, vip_min_charge_mode: "minimum", ...over,
});

const SEATS: MinimumChargeSeat[] = [
  { id: 11, number: 1, type: "vip", platform: "ps5", status: "active" },
  { id: 12, number: 2, type: "vip", platform: "ps5", status: "active" },
  { id: 14, number: 4, type: "standard", platform: "ps5", status: "active" },
];
const MATRIX = { "ps5-vip": 3000, "ps5-standard": 1500 };
const mount = async (s: IBillingSettings, matrix: Record<string, number> = MATRIX) => {
  await act(async () => {
    render(
      <VipMinimumChargeForm
        branchId={7}
        settings={s}
        seats={SEATS}
        platformName={(slug) => slug.toUpperCase()}
        rateOptionsFor={(tiers: readonly SeatTier[]) => rateOptions(matrix, [], SEATS, (slug) => slug.toUpperCase(), tiers)}
        onSaved={() => {}}
      />,
    );
  });
};
const toggle = async () => { await act(async () => { fireEvent.click(screen.getByRole("switch")); }); };
const hours = (id: string) => screen.getByTestId(`${id}-hours`) as HTMLInputElement;
const minutes = (id: string) => screen.getByTestId(`${id}-minutes`) as HTMLInputElement;
const setLength = async (id: string, h: string, m: string) => {
  await act(async () => { fireEvent.change(hours(id), { target: { value: h } }); });
  await act(async () => { fireEvent.change(minutes(id), { target: { value: m } }); });
};
const tab = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${name}`) })); }); };
const save = () => screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement;
const press = async () => { await act(async () => { fireEvent.click(save()); }); };
const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;
const rules = () => Array.from(screen.getByTestId("vip-min-rules").querySelectorAll("li")).map((li) => li.textContent);
const previewRows = () => within(document.querySelector(".vip-min-preview") as HTMLElement)
  .getAllByRole("row").slice(1).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.textContent));

beforeEach(() => { repo.update.mockReset(); repo.update.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("the minimum charge card", () => {
  test("off: says plainly that every seat pays as played; a large switch", async () => {
    await mount(settings());
    expect(screen.getByText("Сейчас выключено: все места оплачиваются только за сыгранное время.")).toBeTruthy();
    expect(screen.queryByTestId("vip-min-after-hours")).toBeNull();
    expect(screen.getByRole("switch").closest(".cp-switch")?.getAttribute("data-size")).toBe("lg");
  });

  test("on: the rule in plain sentences, the owner's numbers in them, VIP by default", async () => {
    await mount(settings());
    await toggle();

    expect(rules()).toEqual([
      "Действует на VIP-местах.",
      "Сидел меньше 20 мин: платит только за сыгранное время.",
      "Сидел 20 мин или больше: платит не меньше чем за 1 ч.",
      "Сидел дольше 1 ч: платит за каждую минуту сверх этого.",
      "Пересадили на другое место: время на всех местах складывается, минимум считается один раз за весь визит.",
    ]);
    // The start dialog's time field: hours and minutes, no quick picks.
    expect([hours("vip-min-after").value, minutes("vip-min-after").value]).toEqual(["0", "20"]);
    expect([hours("vip-min-minimum").value, minutes("vip-min-minimum").value]).toEqual(["1", "00"]);
  });

  test("no rounding to choose, no quick picks: by the minute is the only way past the minimum", async () => {
    await mount(on());
    expect(screen.queryByText(/Округлять вверх/)).toBeNull();
    expect(screen.queryByText("Как считать время сверх минимальной оплаты.")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByRole("tab", { name: "Часы" })).toBeNull();
  });

  test("the example: what the till charges and why, at the VIP 3000/h", async () => {
    await mount(on());

    expect(previewRows()).toEqual([
      ["19 мин", "950·AMD", "по факту"],
      ["20 мин", "3000·AMD", "минимум 1 ч"],
      ["1 ч", "3000·AMD", "минимум 1 ч"],
      ["1 ч 10 мин", "3500·AMD", "по минутам"],
    ]);
    expect(screen.getByTestId("vip-min-move").textContent).toBe(
      "Пересадили: 15 мин на одном месте и 15 мин на другом. Вместе 30 мин, к оплате 3000·AMD (минимум 1 ч), один раз.",
    );
  });

  test("saves the rule in minutes, by the minute, VIP, and every other answer untouched", async () => {
    await mount(settings());
    await toggle();
    await setLength("vip-min-after", "1", "00");
    await setLength("vip-min-minimum", "5", "00");
    await press();

    expect(sent()).toEqual({
      money_rounding_step: 100, money_rounding_mode: "nearest", joystick_price: 500,
      joystick_included: 2, joystick_charged_slots: "3,4", joystick_pricing_mode: "hourly",
      joystick_price_4: 700, joystick_max_slot: 4, joystick_strategy_mode: "change_tariff",
      vip_min_charge_enabled: true, vip_min_charge_after_minutes: 60, vip_min_charge_minutes: 300,
      vip_min_charge_mode: "minimum", vip_min_charge_scope: "vip",
    });
  });

  test("every seat: saved as all, the example offers both prices", async () => {
    await mount(on());
    await tab("Все места");
    expect(rules()[0]).toBe("Действует на всех местах филиала.");
    const picker = screen.getByLabelText("Как это посчитается для") as HTMLSelectElement;
    expect(Array.from(picker.options).map((o) => o.textContent)).toEqual(["PS5 VIP, 3000·AMD в час", "PS5, 1500·AMD в час"]);

    await press();
    expect(sent()).toMatchObject({ vip_min_charge_scope: "all" });
    expect(sent()).not.toHaveProperty("vip_min_charge_place_ids");
  });

  test("standard seats: the example is worked at the standard price", async () => {
    await mount(on());
    await tab("Обычные");
    expect(screen.getByText("Как это посчитается: PS5, 1500·AMD в час")).toBeTruthy();
    expect(previewRows()[1]).toEqual(["20 мин", "1500·AMD", "минимум 1 ч"]);
  });

  test("chosen seats: at least one, and exactly those are sent", async () => {
    await mount(on());
    await tab("Выбрать места");
    expect(screen.getByTestId("vip-min-no-seats").textContent).toBe("Отметьте хотя бы одно место.");
    expect(save().disabled).toBe(true);

    await act(async () => { fireEvent.click(screen.getByLabelText("№4 · PS5")); });
    await act(async () => { fireEvent.click(screen.getByLabelText("№2 · PS5 · VIP")); });
    expect(rules()[0]).toBe("Действует на выбранных местах (2).");
    await press();
    expect(sent()).toMatchObject({ vip_min_charge_scope: "places", vip_min_charge_place_ids: [14, 12] });
  });

  test("a saved choice of seats opens as saved, and a change to it is a change", async () => {
    await mount(on({ vip_min_charge_scope: "places", vip_min_charge_place_ids: [11] }));
    expect((screen.getByLabelText("№1 · PS5 · VIP") as HTMLInputElement).checked).toBe(true);
    expect(save().disabled).toBe(true);

    await act(async () => { fireEvent.click(screen.getByLabelText("№4 · PS5")); });
    expect(save().disabled).toBe(false);
  });

  test("a minimum shorter than the threshold is refused before any request", async () => {
    await mount(on());
    await setLength("vip-min-after", "0", "30");
    await setLength("vip-min-minimum", "0", "20");

    expect(screen.getByText("Минимальная оплата (20 мин) не может быть меньше времени, с которого она действует (30 мин).")).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("switching it off sends only the switch, keeping the typed values on the branch", async () => {
    await mount(on());
    await toggle();
    await press();
    expect(sent()).toMatchObject({ vip_min_charge_enabled: false });
    expect(sent()).not.toHaveProperty("vip_min_charge_minutes");
    expect(sent()).not.toHaveProperty("vip_min_charge_scope");
  });

  test("with no price for these seats, says how to see an example instead of inventing one", async () => {
    await mount(on(), {});
    expect(screen.getByText("Укажите цену за час для этих мест выше, чтобы увидеть пример.")).toBeTruthy();
  });

  test("a saved rule opens as saved; nothing changed, nothing to save; a change warns it is for new visits", async () => {
    await mount(on({ vip_min_charge_after_minutes: 15, vip_min_charge_minutes: 120 }));
    expect(save().disabled).toBe(true);
    expect(screen.queryByText(/^Новые настройки действуют/)).toBeNull();

    await setLength("vip-min-minimum", "3", "00");
    expect(save().disabled).toBe(false);
    expect(screen.getByText(/^Новые настройки действуют/)).toBeTruthy();
  });

  test("a branch still on rounding up opens with something to save: it will be by the minute", async () => {
    await mount(on({ vip_min_charge_mode: "round_up" }));
    expect(save().disabled).toBe(false);
  });
});
