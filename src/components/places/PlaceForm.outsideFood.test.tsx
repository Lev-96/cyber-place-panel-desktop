// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";

/**
 * A place's own «Свои продукты» fee (2026-11-13, owner: "VIP, standard, or
 * specific places"). Empty = the branch's figure for this place's tier (null);
 * 0 = not charged in this room (a decision, sent as 0); a figure beats the
 * branch. Opening and saving a place must keep what it carries.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), nextNumber: vi.fn() }));
const billing = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => ({ id: 7, price_for_branch: { id: 1, branch_id: 7, "ps5-standard": 3000, "ps5-vip": 5000 } }) },
}));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { get: (...a: unknown[]) => billing.get(...a) },
}));
vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    update: (...a: unknown[]) => repo.update(...a),
    nextNumber: (...a: unknown[]) => repo.nextNumber(...a),
  },
}));
vi.mock("@/repositories/GameRepository", () => ({ gameRepository: { list: async () => [] } }));
vi.mock("@/repositories/SubplatformRepository", () => ({
  subplatformRepository: {
    listByPlatform: async () => [
      { id: 1, name_en: "Default", name_ru: "Default", name_am: "Default", is_default: true, price_standard: null, price_vip: null },
    ],
  },
}));
vi.mock("@/api/translations", () => ({ apiSaveEntityTranslations: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k.startsWith("place.outsideFood.hint") ? `${k} {0}` : k),
    money: (n: number) => `${n} AMD`, currency: "AMD", lang: "ru",
  }),
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/MultiLangInput", () => ({
  default: () => null,
  langValuesFromField: () => ({ en: "", ru: "", am: "" }),
  primaryValue: () => "Seat",
}));
vi.mock("@/components/ui/SubplatformTabs", () => ({ default: () => null }));

import PlaceForm from "./PlaceForm";

const place = (over: Partial<IBranchPlace> = {}): IBranchPlace => ({
  id: 12, branch_id: 7, number: 3, name: "Seat 3", type: "standard",
  status: "active", platform: "ps5", subplatform_id: 1, games: [], ...over,
});
const mount = async (initial?: IBranchPlace) => {
  await act(async () => {
    render(<PlaceForm branchId={7} initial={initial} platformPrices={[]} onClose={() => {}} onSaved={() => {}} />);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const box = () => screen.getByLabelText("place.outsideFood") as HTMLInputElement;
const hint = () => screen.getByTestId("place-outside-food-hint").textContent ?? "";
const type = async (v: string) => { await act(async () => { fireEvent.change(box(), { target: { value: v } }); }); };
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
const sent = () => (repo.update.mock.calls[0]?.[1] ?? repo.create.mock.calls[0]?.[0]) as Record<string, unknown>;

beforeEach(() => {
  repo.create.mockReset(); repo.update.mockReset(); repo.nextNumber.mockReset();
  repo.create.mockResolvedValue({ id: 12 });
  repo.update.mockResolvedValue({ id: 12 });
  repo.nextNumber.mockResolvedValue(3);
  billing.get.mockReset();
  billing.get.mockResolvedValue({
    branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 500, joystick_included: 2,
    joystick_charged_slots: null, joystick_pricing_mode: "fixed",
    outside_food_fee_standard: 1000, outside_food_fee_vip: 2000,
  });
});
afterEach(cleanup);

describe("a place's own «Свои продукты» fee", () => {
  test("a new place: empty, sent as null (like the branch)", async () => {
    await mount();
    expect(box().value).toBe("");
    await save();
    expect(sent()).toHaveProperty("outside_food_fee", null);
  });

  test("a figure typed is sent", async () => {
    await mount(place());
    await type("1200");
    await save();
    expect(sent().outside_food_fee).toBe(1200);
  });

  test("0 is a decision: not charged in this room, sent as 0", async () => {
    await mount(place());
    await type("0");
    await save();
    expect(sent().outside_food_fee).toBe(0);
  });

  test.each([[800, 800], [0, 0], [null, null]])("opened and saved untouched, the stored %s goes back as it was", async (stored, expected) => {
    await mount(place({ outside_food_fee: stored }));
    await save();
    expect(sent()).toHaveProperty("outside_food_fee", expected);
  });

  test("cleared, the stored figure goes: null, the branch's applies again", async () => {
    await mount(place({ outside_food_fee: 800 }));
    expect(box().value).toBe("800");
    await type("");
    await save();
    expect(sent()).toHaveProperty("outside_food_fee", null);
  });

  test("the hint names the branch's figure for THIS place's tier", async () => {
    await mount(place({ type: "vip" }));
    expect(hint()).toContain("place.outsideFood.hintBranch");
    expect(hint()).toContain("2000 AMD");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "STANDARD" })); });
    expect(hint()).toContain("1000 AMD");
  });

  test("a tier the branch does not charge says so", async () => {
    billing.get.mockResolvedValue({
      branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 500, joystick_included: 2,
      joystick_charged_slots: null, joystick_pricing_mode: "fixed",
      outside_food_fee_standard: null, outside_food_fee_vip: 2000,
    });
    await mount(place());
    expect(hint()).toContain("place.outsideFood.hintBranchNone");
  });

  test("an older backend (no branch figure known): the general hint", async () => {
    billing.get.mockResolvedValue({ branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 500, joystick_included: 2 });
    await mount(place());
    expect(hint()).toContain("place.outsideFood.hint ");
    expect(hint()).not.toContain("hintBranch");
  });
});
