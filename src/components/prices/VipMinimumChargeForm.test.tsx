// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * The owner's VIP minimum charge, read the way an owner reads it — in the real
 * Russian copy, so what is asserted is the sentence on screen, not a key.
 *
 * Saved through a PUT of the policy like every money rule here, so every other
 * answer must go back exactly as it was; lengths are typed in hours OR minutes
 * and always saved as minutes; the example table must show what the till would
 * charge (the backend pins the same figures) and why.
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

import VipMinimumChargeForm from "./VipMinimumChargeForm";

const AFTER = "С какого времени действует минимум";
const MINIMUM = "Минимальная оплата";

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

const mount = async (s: IBillingSettings, vipRate: number | null = 3000) => {
  await act(async () => { render(<VipMinimumChargeForm branchId={7} settings={s} vipRate={vipRate} onSaved={() => {}} />); });
};
const toggle = async () => { await act(async () => { fireEvent.click(screen.getByRole("switch")); }); };
const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const typeInto = async (label: string, v: string) => {
  await act(async () => { fireEvent.change(box(label), { target: { value: v } }); });
};
/** Hours ↔ minutes of one question. */
const unit = async (label: string, name: "Часы" | "Минуты") => {
  const question = box(label).closest(".vip-min-question") as HTMLElement;
  await act(async () => { fireEvent.click(within(question).getByRole("tab", { name })); });
};
const save = () => screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement;
const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;
const rules = () => Array.from(screen.getByTestId("vip-min-rules").querySelectorAll("li")).map((li) => li.textContent);
const previewRows = () => within(document.querySelector(".vip-min-preview") as HTMLElement)
  .getAllByRole("row").slice(1).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.textContent));

beforeEach(() => { repo.update.mockReset(); repo.update.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("the VIP minimum charge card", () => {
  test("off: says plainly what VIP costs now", async () => {
    await mount(settings());
    expect(screen.getByText("Сейчас выключено: VIP оплачивается только за сыгранное время.")).toBeTruthy();
    expect(screen.queryByLabelText(AFTER)).toBeNull();
  });

  test("on: the rule in plain sentences, the owner's numbers in them", async () => {
    await mount(settings());
    await toggle();

    expect(rules()).toEqual([
      "Сидел меньше 20 мин: платит только за сыгранное время.",
      "Сидел 20 мин или больше: платит не меньше чем за 1 ч.",
      "Сидел дольше 1 ч: платит за каждую минуту сверх этого.",
      "Пересадили на другое место: время на всех местах складывается, минимум считается один раз за весь визит.",
    ]);
    // A whole hour opens in hours, twenty minutes in minutes.
    expect(box(MINIMUM).value).toBe("1");
    expect(box(AFTER).value).toBe("20");
  });

  test("the example: what the till charges and why, at 3000/h", async () => {
    await mount(settings());
    await toggle();

    expect(previewRows()).toEqual([
      ["19 мин", "950·AMD", "по факту"],
      ["20 мин", "3000·AMD", "минимум 1 ч"],
      ["1 ч", "3000·AMD", "минимум 1 ч"],
      ["1 ч 10 мин", "3500·AMD", "по минутам"],
    ]);
    // A move: neither half reaches 20 min, together they do, and it is paid once.
    expect(screen.getByTestId("vip-min-move").textContent).toBe(
      "Пересадили: 15 мин на одном VIP и 15 мин на другом. Вместе 30 мин, к оплате 3000·AMD (минимум 1 ч), один раз.",
    );
  });

  test("rounding up: the choice shows its own worked case, the table follows", async () => {
    await mount(settings());
    await toggle();
    await act(async () => { fireEvent.click(screen.getByLabelText("Округлять вверх до целого минимума (сыграл 1 ч 10 мин, платит за 2 ч)")); });

    expect(rules()[2]).toBe("Сидел дольше 1 ч: время округляется вверх до целых блоков по 1 ч.");
    expect(previewRows()[3]).toEqual(["1 ч 10 мин", "6000·AMD", "округлено до 2 ч"]);
    expect(screen.getByLabelText("Поминутно (сыграл 1 ч 10 мин, платит за 1 ч 10 мин)")).toBeTruthy();
  });

  test("saves the rule in minutes, and every other answer untouched", async () => {
    await mount(settings());
    await toggle();
    await act(async () => { save().click(); });

    expect(sent()).toMatchObject({
      vip_min_charge_enabled: true, vip_min_charge_after_minutes: 20, vip_min_charge_minutes: 60, vip_min_charge_mode: "minimum",
      money_rounding_step: 100, money_rounding_mode: "nearest", joystick_price: 500, joystick_included: 2,
      joystick_charged_slots: "3,4", joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
    });
    // Fields this form does not own are left out, which leaves them alone.
    expect(sent()).not.toHaveProperty("pause_limit_minutes");
  });

  test("hours: 5 h of minimum and 1 h threshold are saved as 300 and 60 minutes", async () => {
    await mount(settings());
    await toggle();
    await typeInto(MINIMUM, "5");
    await unit(AFTER, "Часы");
    await typeInto(AFTER, "1");

    expect(rules()[1]).toBe("Сидел 1 ч или больше: платит не меньше чем за 5 ч.");
    await act(async () => { save().click(); });
    expect(sent()).toMatchObject({ vip_min_charge_after_minutes: 60, vip_min_charge_minutes: 300 });
  });

  test("switching the unit keeps the length: 1 h becomes 60 min, not 1 min", async () => {
    await mount(settings());
    await toggle();
    await unit(MINIMUM, "Минуты");
    expect(box(MINIMUM).value).toBe("60");
  });

  test("a minimum shorter than the threshold is refused, in either mode, before any request", async () => {
    await mount(settings());
    await toggle();
    await typeInto(AFTER, "30");
    await unit(MINIMUM, "Минуты");
    await typeInto(MINIMUM, "20");

    const said = "Минимальная оплата (20 мин) не может быть меньше времени, с которого она действует (30 мин).";
    expect(screen.getByText(said)).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(screen.queryByTestId("vip-min-rules")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByLabelText(/^Округлять вверх/)); });
    expect(screen.getByText(said)).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  test("past 24 hours, or not a whole minute, is refused", async () => {
    await mount(settings());
    await toggle();
    await typeInto(MINIMUM, "25");
    expect(screen.getByText("Укажите время от 1 минуты до 24 часов, в целых минутах.")).toBeTruthy();
    expect(save().disabled).toBe(true);

    await typeInto(MINIMUM, "24");
    expect(save().disabled).toBe(false);
  });

  test("switching it off sends only the switch, keeping the typed values on the branch", async () => {
    await mount(on());
    await toggle();
    await act(async () => { save().click(); });

    expect(sent()).toMatchObject({ vip_min_charge_enabled: false });
    expect(sent()).not.toHaveProperty("vip_min_charge_minutes");
  });

  test("with no VIP price set, says how to see an example instead of inventing one", async () => {
    await mount(settings(), null);
    await toggle();

    expect(document.querySelector(".vip-min-preview")).toBeNull();
    expect(screen.getByText("Укажите цену VIP за час выше, чтобы увидеть пример.")).toBeTruthy();
  });

  test("a saved rule opens as saved; nothing changed, nothing to save; a change warns it is for new visits", async () => {
    await mount(on({ vip_min_charge_after_minutes: 15, vip_min_charge_minutes: 120, vip_min_charge_mode: "round_up" }));

    expect(box(AFTER).value).toBe("15");
    expect(box(MINIMUM).value).toBe("2");
    expect(save().disabled).toBe(true);
    expect(screen.queryByText(/^Новые настройки действуют/)).toBeNull();

    await typeInto(MINIMUM, "3");
    expect(save().disabled).toBe(false);
    expect(screen.getByText(/^Новые настройки действуют/)).toBeTruthy();
  });
});
