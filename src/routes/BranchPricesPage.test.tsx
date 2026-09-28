// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
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
vi.mock("@/repositories/PlatformPriceRepository", () => ({
  platformPriceRepository: { listByBranch: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/repositories/SubplatformRepository", () => ({
  subplatformRepository: { listByBranch: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/components/branches/HourlyRatesForm", () => ({ default: () => <div>hourly-form</div> }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
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
});

describe("Branch → Prices", () => {
  test("the rules load STRICTLY: getForEdit, never the defaulting get()", async () => {
    await mount();
    expect(billing.getForEdit).toHaveBeenCalledWith(7);
    expect(billing.get).not.toHaveBeenCalled();
    // Four rule forms, each with its own Save.
    expect(saveButtons().length).toBe(4);
  });

  test("a failed load shows the error and a retry — and NO billing form to save", async () => {
    billing.getForEdit.mockRejectedValue(new Error("Network error"));
    await mount();

    expect(saveButtons().length).toBe(0);
    expect(screen.getAllByRole("alert").length).toBe(4);
    expect(document.body.textContent).toContain("Network error");

    billing.getForEdit.mockResolvedValue(settings);
    await act(async () => { screen.getAllByRole("button", { name: "action.retry" })[0].click(); });
    expect(saveButtons().length).toBe(4);
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
});
