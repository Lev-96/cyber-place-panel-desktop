// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Branch → Prices, the page around the forms (the forms have their own tests).
 *
 * The one rule that is about MONEY here: when the branch's billing policy
 * cannot be read, the page must show the failure and a retry — and draw NO
 * billing form. It used to load defaults on a network failure, and the next
 * Save on any rule PUT "no joystick fee, no rounding" over the real policy.
 */

const billing = vi.hoisted(() => ({ getForEdit: vi.fn(), get: vi.fn(), update: vi.fn() }));
const packages = vi.hoisted(() => ({ listByBranch: vi.fn(), update: vi.fn(), remove: vi.fn() }));
const placesRepo = vi.hoisted(() => ({ listRawByBranch: vi.fn() }));

vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: {
    getForEdit: (...a: unknown[]) => billing.getForEdit(...a),
    get: (...a: unknown[]) => billing.get(...a),
    update: (...a: unknown[]) => billing.update(...a),
  },
}));
vi.mock("@/repositories/TimePackageRepository", () => ({
  timePackageRepository: {
    listByBranch: (...a: unknown[]) => packages.listByBranch(...a),
    update: (...a: unknown[]) => packages.update(...a),
    remove: (...a: unknown[]) => packages.remove(...a),
  },
}));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: vi.fn().mockResolvedValue({ id: 7, pricing: {} }), updatePricing: vi.fn() },
}));
vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: { listRawByBranch: (...a: unknown[]) => placesRepo.listRawByBranch(...a) },
}));
vi.mock("@/repositories/PlatformPriceRepository", () => ({
  platformPriceRepository: { listByBranch: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/repositories/SubplatformRepository", () => ({
  subplatformRepository: { listByBranch: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/components/branches/HourlyRatesForm", () => ({ default: () => <div>hourly-form</div> }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en", currency: "AMD" }),
}));

import BranchPricesPage from "./BranchPricesPage";

const settings = {
  branch_id: 7, money_rounding_step: 100, money_rounding_mode: "up", joystick_price: 500,
  joystick_included: 2, joystick_charged_slots: "3,4", joystick_pricing_mode: "fixed",
  joystick_price_4: null, joystick_max_slot: 4, pause_limit_minutes: 10,
};

const mount = async () => {
  await act(async () => {
    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={["/branches/7/tariffs"]}>
          <Routes><Route path="/branches/:branchId/tariffs" element={<BranchPricesPage />} /></Routes>
        </MemoryRouter>
      </ConfirmProvider>,
    );
  });
};

const saveButtons = () => [...document.querySelectorAll("button")].filter((b) => b.textContent === "action.save");

afterEach(cleanup);
beforeEach(() => {
  Object.values(billing).forEach((f) => f.mockReset());
  Object.values(packages).forEach((f) => f.mockReset());
  billing.getForEdit.mockResolvedValue(settings);
  packages.listByBranch.mockResolvedValue([
    { id: 3, name_en: "Hour", name_ru: "Час", name_am: "Ժամ", duration_minutes: 60, price: 1500, is_active: true },
  ]);
  packages.remove.mockResolvedValue(undefined);
  placesRepo.listRawByBranch.mockReset();
  placesRepo.listRawByBranch.mockResolvedValue([]);
});

describe("Branch → Prices", () => {
  test("the rules load STRICTLY: getForEdit, never the defaulting get()", async () => {
    await mount();
    expect(billing.getForEdit).toHaveBeenCalledWith(7);
    expect(billing.get).not.toHaveBeenCalled();
    // Six rule forms, each with its own Save (the VIP minimum charge is the
    // fifth, «Свои продукты» the sixth, 2026-11-13).
    expect(saveButtons().length).toBe(6);
  });

  test("a failed load shows the error and a retry — and NO billing form to save", async () => {
    billing.getForEdit.mockRejectedValue(Object.assign(new Error("Network error"), { status: 500, body: { message: "Network error" } }));
    await mount();

    expect(saveButtons().length).toBe(0);
    // One error state per billing section, each with the server's sentence as
    // its detail and its own Retry.
    expect(screen.getAllByRole("alert").length).toBe(6);
    expect(screen.getAllByText("state.error.title").length).toBe(6);
    expect(document.body.textContent).toContain("Network error");

    billing.getForEdit.mockResolvedValue(settings);
    await act(async () => { screen.getAllByRole("button", { name: "action.retry" })[0].click(); });
    expect(saveButtons().length).toBe(6);
  });

  test("«Свои продукты» is one of the billing rules (2026-11-13)", async () => {
    await mount();
    const text = document.body.textContent ?? "";
    expect(text.indexOf("prices.group.rules")).toBeLessThan(text.indexOf("outsideFood.sectionTitle"));
    expect(screen.getByLabelText("outsideFood.standard")).toBeTruthy();
    expect(screen.getByLabelText("outsideFood.vip")).toBeTruthy();
  });

  test("the page is grouped: rates, packages, rules", async () => {
    await mount();
    const text = document.body.textContent ?? "";
    expect(text.indexOf("prices.group.rates")).toBeLessThan(text.indexOf("prices.group.packages"));
    expect(text.indexOf("prices.group.packages")).toBeLessThan(text.indexOf("prices.group.rules"));
  });

  test("deleting a package asks in the app's own dialog, and a No deletes nothing", async () => {
    const native = vi.spyOn(window, "confirm");
    await mount();

    await act(async () => { screen.getByRole("button", { name: "action.delete" }).click(); });
    expect(native).not.toHaveBeenCalled();
    await act(async () => { screen.getByRole("button", { name: "action.cancel" }).click(); });
    expect(packages.remove).not.toHaveBeenCalled();

    // The row's button comes first; the dialog is portalled after the page.
    await act(async () => { screen.getAllByRole("button", { name: "action.delete" })[0].click(); });
    const dialogDelete = screen.getAllByRole("button", { name: "action.delete" }).at(-1)!;
    await act(async () => { dialogDelete.click(); });
    expect(packages.remove).toHaveBeenCalledWith(3);
    native.mockRestore();
  });

  test("an inactive package says so in words, not only by fading", async () => {
    packages.listByBranch.mockResolvedValue([
      { id: 4, name_en: "Night", name_ru: "Ночь", name_am: "Գիշեր", duration_minutes: 300, price: 4000, is_active: false },
    ]);
    await mount();
    expect(screen.getByText("prices.packageInactive")).toBeTruthy();
  });

  test("«Свои продукты» per place: the places reach the form, and its Save reloads the policy AND the places (2026-11-14)", async () => {
    const place = { id: 11, branch_id: 7, number: 3, name: "Corner", type: "standard", status: "active", platform: "pc", outside_food_fee: 900, games: [] };
    placesRepo.listRawByBranch.mockResolvedValue([place]);
    billing.update.mockResolvedValue(settings);
    await mount();
    const row = screen.getByTestId("outside-food-place-11");
    expect(row.textContent).toContain("№3 · Corner");
    const before = { billing: billing.getForEdit.mock.calls.length, places: placesRepo.listRawByBranch.mock.calls.length };

    // The server now says 0 here: the form re-opens on the new figure (its key).
    placesRepo.listRawByBranch.mockResolvedValue([{ ...place, outside_food_fee: 0 }]);
    const form = row.closest("form")!;
    const box = form.querySelector<HTMLInputElement>('[data-testid="outside-food-place-11"] input.input')!;
    await act(async () => { fireEvent.change(box, { target: { value: "0" } }); });
    const formSave = [...form.querySelectorAll("button")].find((b) => b.textContent === "action.save")!;
    await act(async () => { formSave.click(); });

    expect(billing.update.mock.calls[0][1]).toMatchObject({ outside_food_place_fees: [{ place_id: 11, fee: 0 }] });
    expect(billing.getForEdit.mock.calls.length).toBe(before.billing + 1);
    expect(placesRepo.listRawByBranch.mock.calls.length).toBe(before.places + 1);
    const after = screen.getByTestId("outside-food-place-11").querySelector<HTMLInputElement>("input.input")!;
    expect(after.value).toBe("0");
    expect(screen.getByTestId("outside-food-place-11").getAttribute("data-changed")).toBeNull();
  });
});
