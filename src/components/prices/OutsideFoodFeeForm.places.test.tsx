// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";
import type { FeePlace } from "./outsideFoodPlaces";

/**
 * «Своя сумма для отдельных мест» (2026-11-14, owner) in the Prices page's
 * «Свои продукты» form: a place's own figure (`places.outside_food_fee`) is
 * set here, saved by the SAME Save as the tiers, through the same PUT. Only
 * the rows the owner changed travel (`outside_food_place_fees`), each as a
 * figure, 0 (not charged here) or null (like the branch); nothing changed in
 * the list = the key is left out, which leaves every place alone.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
const TEMPLATES: Record<string, string> = {
  "outsideFood.places.placeholder": "branch ({0})",
  "outsideFood.places.summary": "own {0} / none {1} / branch {2}",
  "outsideFood.places.pending": "pending {0}",
  "outsideFood.places.inputLabel": "fee №{0}",
};
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => TEMPLATES[k] ?? k, money: (n: number) => `${n} AMD`, lang: "ru", currency: "AMD" }),
}));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => true }));

import OutsideFoodFeeForm from "./OutsideFoodFeeForm";

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7, money_rounding_step: 100, money_rounding_mode: "nearest",
  joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff", pause_limit_minutes: 30,
  outside_food_fee_standard: 1000, outside_food_fee_vip: 1500,
  ...over,
});

const place = (id: number, over: Partial<FeePlace> = {}): FeePlace => ({
  id, number: id, name: `Seat ${id}`, type: "standard", platform: "pc", status: "active", outside_food_fee: null, ...over,
});

const PLACES: FeePlace[] = [
  place(1),
  place(2, { type: "vip" }),
  place(3, { outside_food_fee: 2500 }),
  place(4, { type: "vip", outside_food_fee: 0, platform: "ps5" }),
  place(5, { status: "inactive" }),
];

const retry = vi.fn();
const saved = vi.fn();
const mount = async (opts: { s?: IBillingSettings; places?: FeePlace[] | null; error?: unknown } = {}) => {
  await act(async () => {
    render(
      <OutsideFoodFeeForm
        branchId={7}
        settings={opts.s ?? settings()}
        places={opts.places === undefined ? PLACES : opts.places}
        placesError={opts.error ?? null}
        onRetryPlaces={retry}
        platformName={(slug) => slug.toUpperCase()}
        onSaved={saved}
      />,
    );
  });
};
const type = async (input: HTMLElement, value: string) => {
  await act(async () => { fireEvent.change(input, { target: { value } }); });
};
const row = (id: number) => screen.getByTestId(`outside-food-place-${id}`);
const box = (id: number) => screen.getByLabelText(new RegExp(`^fee №${id}( ·|$)`)) as HTMLInputElement;
const notHere = (id: number) => within(row(id)).getByRole("checkbox") as HTMLInputElement;
const tab = (key: string) => screen.getByRole("tab", { name: new RegExp(`^outsideFood\\.places\\.tab\\.${key}`) });
const save = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
const clickSave = async () => { await act(async () => { save().click(); }); };
const sent = () => repo.update.mock.calls[0][1] as Record<string, unknown>;

const POLICY = {
  money_rounding_step: 100, money_rounding_mode: "nearest",
  joystick_price: 500, joystick_included: 2, joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly", joystick_price_4: 700, joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff",
};

beforeEach(() => {
  repo.update.mockReset();
  repo.update.mockResolvedValue(undefined);
  retry.mockReset();
  saved.mockReset();
});
afterEach(cleanup);

describe("own figures for single places", () => {
  test("the placeholder follows the tier figure typed right now, per the place's tier", async () => {
    await mount();
    await act(async () => { tab("all").click(); });
    expect(box(1).placeholder).toBe("branch (1000 AMD)");
    expect(box(2).placeholder).toBe("branch (1500 AMD)");

    await type(screen.getByLabelText("outsideFood.standard"), "1200");
    expect(box(1).placeholder).toBe("branch (1200 AMD)");
    expect(box(2).placeholder).toBe("branch (1500 AMD)");

    await type(screen.getByLabelText("outsideFood.vip"), "");
    expect(box(2).placeholder).toBe("outsideFood.places.placeholderNone");
  });

  test("«not charged here» = 0: ticks to 0, disables the box; a typed 0 ticks it", async () => {
    await mount();
    await act(async () => { tab("all").click(); });
    expect(notHere(1).checked).toBe(false);
    await act(async () => { fireEvent.click(notHere(1)); });
    expect(notHere(1).checked).toBe(true);
    expect(box(1).disabled).toBe(true);
    expect(box(1).value).toBe("0");

    await type(box(2), "0");
    expect(notHere(2).checked).toBe(true);

    // The stored 0 opens ticked; unticking returns it to «like the branch».
    expect(notHere(4).checked).toBe(true);
    await act(async () => { fireEvent.click(notHere(4)); });
    expect(box(4).value).toBe("");
  });

  test("only the changed rows are sent — a figure, 0 and null — with the policy unchanged and the tiers as typed", async () => {
    await mount();
    await act(async () => { tab("all").click(); });
    await type(box(1), "700");
    await act(async () => { fireEvent.click(notHere(2)); });
    await type(box(3), "");
    // Typed and typed back: not a change.
    await type(box(5), "300");
    await type(box(5), "");
    await clickSave();

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update.mock.calls[0][0]).toBe(7);
    expect(sent()).toEqual({
      ...POLICY,
      outside_food_fee_standard: 1000,
      outside_food_fee_vip: 1500,
      outside_food_place_fees: [
        { place_id: 1, fee: 700 },
        { place_id: 2, fee: 0 },
        { place_id: 3, fee: null },
      ],
    });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  test("only the tiers changed: no place key at all", async () => {
    await mount();
    await type(screen.getByLabelText("outsideFood.standard"), "1100");
    await clickSave();
    expect(sent()).toEqual({ ...POLICY, outside_food_fee_standard: 1100, outside_food_fee_vip: 1500 });
    expect("outside_food_place_fees" in sent()).toBe(false);
  });

  test("only a place changed: Save is on, and the tiers go back as stored", async () => {
    await mount();
    expect(save().disabled).toBe(true);
    await act(async () => { tab("all").click(); });
    await type(box(1), "900");
    expect(save().disabled).toBe(false);
    await clickSave();
    expect(sent()).toMatchObject({ outside_food_fee_standard: 1000, outside_food_fee_vip: 1500, outside_food_place_fees: [{ place_id: 1, fee: 900 }] });
  });

  test("tabs carry counts; «with own amount» is the default when any exists, «all» otherwise", async () => {
    await mount();
    expect(tab("own").getAttribute("aria-selected")).toBe("true");
    expect(tab("all").textContent).toContain("5");
    expect(tab("vip").textContent).toContain("2");
    expect(tab("standard").textContent).toContain("3");
    expect(tab("own").textContent).toContain("2");
    expect(screen.queryByTestId("outside-food-place-1")).toBeNull();
    expect(row(3)).toBeTruthy();
    expect(row(4)).toBeTruthy();

    await act(async () => { tab("vip").click(); });
    expect(screen.queryByTestId("outside-food-place-1")).toBeNull();
    expect(row(2)).toBeTruthy();

    cleanup();
    await mount({ places: [place(1), place(2)] });
    expect(tab("all").getAttribute("aria-selected")).toBe("true");
  });

  test("rows: «№N · name», a VIP chip, «inactive», the state chip; grouped by platform", async () => {
    await mount();
    await act(async () => { tab("all").click(); });
    expect(row(1).textContent).toContain("№1 · Seat 1");
    expect(within(row(2)).getByText("VIP")).toBeTruthy();
    expect(within(row(5)).getByText("outsideFood.places.inactive")).toBeTruthy();
    expect(within(row(3)).getByText("outsideFood.places.state.own")).toBeTruthy();
    expect(within(row(4)).getByText("outsideFood.places.state.notCharged")).toBeTruthy();
    expect(within(row(1)).getByText("outsideFood.places.state.branch")).toBeTruthy();
    const groups = screen.getAllByTestId("outside-food-group").map((g) => g.getAttribute("data-platform"));
    expect(groups).toEqual(["pc", "ps5"]);
    expect(screen.getByText("PS5")).toBeTruthy();
  });

  test("the summary counts ALL places, and the pending counter follows the edits", async () => {
    await mount();
    expect(screen.getByTestId("outside-food-summary").textContent).toContain("own 1 / none 1 / branch 3");
    expect(screen.queryByText("pending 0")).toBeNull();
    await act(async () => { tab("all").click(); });
    await type(box(1), "0");
    await type(box(2), "800");
    expect(screen.getByTestId("outside-food-summary").textContent).toContain("own 2 / none 2 / branch 1");
    expect(screen.getByText("pending 2")).toBeTruthy();
    expect(screen.getByText("outsideFood.places.appliesToNew")).toBeTruthy();
  });

  test("search appears past 12 places and finds by number or name", async () => {
    await mount();
    expect(screen.queryByRole("searchbox")).toBeNull();
    cleanup();
    const many = Array.from({ length: 13 }, (_, i) => place(i + 1, { name: i === 12 ? "Corner" : `Seat ${i + 1}` }));
    await mount({ places: many });
    const search = screen.getByRole("searchbox");
    await type(search, "corner");
    expect(screen.getAllByTestId(/^outside-food-place-/).map((r) => r.dataset.testid)).toEqual(["outside-food-place-13"]);
    await type(search, "1");
    expect(screen.getAllByTestId(/^outside-food-place-/)).toHaveLength(5); // 1, 10, 11, 12, 13
    await type(search, "99");
    expect(screen.getByText("outsideFood.places.noMatches")).toBeTruthy();
  });

  test("places failed to load: an error with a retry; the tiers still save, without the place key", async () => {
    await mount({ places: null, error: Object.assign(new Error("boom"), { status: 500 }) });
    expect(screen.getByText("outsideFood.places.loadError")).toBeTruthy();
    await act(async () => { screen.getByRole("button", { name: "action.retry" }).click(); });
    expect(retry).toHaveBeenCalledTimes(1);

    await type(screen.getByLabelText("outsideFood.standard"), "1300");
    await clickSave();
    expect(sent()).toEqual({ ...POLICY, outside_food_fee_standard: 1300, outside_food_fee_vip: 1500 });
  });

  test("Save is off while any box is invalid (a place over the ceiling, or a tier at 0)", async () => {
    await mount();
    await act(async () => { tab("all").click(); });
    await type(box(1), "100000000");
    expect(save().disabled).toBe(true);
    expect(within(row(1)).getByText("outsideFood.places.state.invalid")).toBeTruthy();
    await act(async () => { fireEvent.submit(save().closest("form")!); });
    expect(repo.update).not.toHaveBeenCalled();

    await type(box(1), "100");
    expect(save().disabled).toBe(false);
    await type(screen.getByLabelText("outsideFood.standard"), "0");
    expect(save().disabled).toBe(true);
  });
});
