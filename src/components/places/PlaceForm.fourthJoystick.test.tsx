// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";

/**
 * The SHAPE of the joystick block: which control holds what, and what moves
 * when the operator answers.
 *
 * The venue's joystick rule lives on the BRANCH and almost every seat runs on
 * it. The exception is the room quoted with four pads in the rate, or the one
 * PlayStation whose second controller is thrown in: a single seat differing
 * must not become a reason to move the whole branch, and moving the branch is
 * what an operator does when the seat has nowhere to say it.
 *
 * Three things here are worth pinning, because each is silent when it breaks:
 *
 *  - an EMPTY box is inherit, and travels as `null` rather than as a 0 that
 *    would quietly make one seat free;
 *  - a typed 0 is NOT inherit. It is "this seat hands extra pads out for
 *    nothing", which is the whole reason the two are different values;
 *  - the question is the PLATFORM's (`platformGroup(...) === "ps"`) and never
 *    the kiosk agent's. A PC seat neither draws the boxes nor carries an
 *    override, and a seat that stops being a PlayStation drops the one it had.
 */

const repo = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  nextNumber: vi.fn(),
}));
const translations = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    update: (...a: unknown[]) => repo.update(...a),
    nextNumber: (...a: unknown[]) => repo.nextNumber(...a),
  },
}));
vi.mock("@/repositories/GameRepository", () => ({
  gameRepository: { list: async () => [] },
}));
// The VENUE's joystick policy — what a room inherits when it prices no pads of
// its own. Answered here so a unit test never reaches for a server.
const BRANCH_POLICY: Record<string, unknown> = {
  branch_id: 7, joystick_price: 500, joystick_charged_slots: null, joystick_pricing_mode: "fixed",
};
// Seeded at hoist time AND re-seeded before every test below, because a
// `vi.fn()` with no implementation returns `undefined` and the form awaits
// this. That is not a failing assertion — it is a rejected promise landing
// wherever the event loop happens to be, which is a test that fails in a full
// run and passes on its own.
const billing = vi.hoisted(() => ({
  // Typed loosely on purpose: a block below hands it a venue on the hourly
  // tariff, and the inferred shape of one literal is not the contract.
  get: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
    branch_id: 7, joystick_price: 500, joystick_charged_slots: null, joystick_pricing_mode: "fixed",
  })),
}));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { get: (...a: unknown[]) => billing.get(...a) },
}));
vi.mock("@/repositories/SubplatformRepository", () => ({
  // One Default sub-category, which is what every branch has and what makes
  // the place bill from its platform rather than from a sub-category's rate.
  subplatformRepository: {
    listByPlatform: async () => [
      { id: 1, name_en: "Default", name_ru: "Default", name_am: "Default", is_default: true, price_standard: null, price_vip: null },
    ],
  },
}));
vi.mock("@/api/translations", () => ({
  apiSaveEntityTranslations: (...a: unknown[]) => translations.save(...a),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  // `currency` and `lang` are what PriceInput reads; AMD keeps the box's
  // displayed figure identical to the stored one, so an assertion about "700"
  // is about this form and not about an exchange rate.
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), currency: "AMD", lang: "ru" }),
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// Irrelevant to the override and noisy in the DOM: the per-language name field
// and the sub-category tabs each render inputs this file would have to skip.
vi.mock("@/components/ui/MultiLangInput", () => ({
  default: () => null,
  langValuesFromField: () => ({ en: "", ru: "", am: "" }),
  primaryValue: () => "Seat",
}));
vi.mock("@/components/ui/SubplatformTabs", () => ({ default: () => null }));

// The branch the seat bills from. Unmocked, `useAsync` reached a real
// repository, resolved late and left the form believing this PlayStation seat
// had no rate to bill at — which the form refuses to save. That is what made
// this suite fail once in three full runs and never on its own.
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: {
    byId: async () => ({ id: 7, price_for_branch: { "ps5-standard": 3000, "ps5-vip": 5000 } }),
  },
}));

import PlaceForm from "./PlaceForm";

beforeEach(() => {
  billing.get.mockReset().mockResolvedValue({ ...BRANCH_POLICY });
});

const place = (over: Partial<IBranchPlace> = {}): IBranchPlace => ({
  id: 12,
  branch_id: 7,
  number: 3,
  name: "Seat 3",
  type: "standard",
  status: "active",
  platform: "ps5",
  subplatform_id: 1,
  games: [],
  ...over,
});

let dom: HTMLElement;

const mount = async (initial?: IBranchPlace) => {
  await act(async () => {
    const r = render(<PlaceForm branchId={7} initial={initial} onClose={() => {}} onSaved={() => {}} />);
    dom = r.container;
  });
};

const EACH = "joystickPrice.chargeMode.each";
const ONCE = "joystickPrice.chargeMode.once";
const THIRD = "place.joystickThirdPrice";
const FOURTH = "place.joystickFourthPrice";

const groupFor = (label: string): HTMLElement => {
  const group = dom.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${label}"]`);
  expect(group, `no radiogroup labelled ${label}`).toBeTruthy();
  return group!;
};
const priceBoxFor = (label: string): HTMLInputElement => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === label);
  expect(heading, `no price box labelled ${label}`).toBeTruthy();
  const box = heading!.parentElement!.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  expect(box, `the box labelled ${label} has no input`).toBeTruthy();
  return box!;
};
const pick = async (label: string) => {
  await act(async () => { fireEvent.click(within(groupFor("place.joystickPayment")).getByLabelText(label)); });
};
const type = async (label: string, v: string) => {
  await act(async () => { fireEvent.change(priceBoxFor(label), { target: { value: v } }); });
};
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
const sent = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(repo.update).toHaveBeenCalledTimes(1), { timeout: 5000 });
  return repo.update.mock.calls[0][1] as Record<string, unknown>;
};

describe("PlaceForm joystick block: shape and promises", () => {
  beforeEach(() => {
    repo.create.mockReset().mockResolvedValue(place());
    repo.update.mockReset().mockResolvedValue(undefined);
    repo.nextNumber.mockReset().mockResolvedValue(4);
    translations.save.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  // ── what each control is allowed to contain ──────────────────────────

  /**
   * A radiogroup holds radios and nothing else. A price box inside one lies to
   * a screen reader about what it is, and it rides the radio row instead of
   * sitting in the column every other figure on this form uses.
   */
  test("the payment methods hold only their own answers", async () => {
    await mount(place());
    await pick(EACH);

    const group = groupFor("place.joystickPayment");
    expect(group.querySelectorAll('input[type="radio"]').length).toBe(2);

    // The boxes belong to the method that opened them, so they live inside the
    // same block — but never inside the group element itself.
    const box = priceBoxFor(THIRD);
    expect(group.contains(box)).toBe(true);
    expect(box.closest('[role="radiogroup"]')).toBe(group);
    expect(group.querySelector('input[type="radio"]')!.parentElement!.contains(box)).toBe(false);
  });

  test("the room's own decision and the tariff are separate groups", async () => {
    await mount(place());

    expect(groupFor("place.joysticks")).toBeTruthy();
    expect(groupFor("place.joystickPayment")).toBeTruthy();
    expect(groupFor("place.joystickTariffChange")).toBeTruthy();
  });

  // ── nothing incompatible on screen at once ───────────────────────────

  test("the two methods never show their boxes together", async () => {
    await mount(place());

    await pick(EACH);
    const afterEach_ = [...dom.querySelectorAll("span.label")].map((el) => el.textContent);
    expect(afterEach_).toContain(THIRD);
    expect(afterEach_).toContain(FOURTH);
    expect(afterEach_).not.toContain("place.joystickPairPrice");

    await pick(ONCE);
    const afterOnce = [...dom.querySelectorAll("span.label")].map((el) => el.textContent);
    expect(afterOnce).toContain("place.joystickPairPrice");
    expect(afterOnce).not.toContain(THIRD);
    expect(afterOnce).not.toContain(FOURTH);
  });

  /** The block grows downwards; the controls above it do not move. */
  test("answering does not move the decision above it", async () => {
    await mount(place());

    const before = groupFor("place.joysticks").querySelectorAll('input[type="radio"]').length;
    await pick(EACH);

    expect(groupFor("place.joysticks").querySelectorAll('input[type="radio"]').length).toBe(before);
  });

  // ── what the fourth box promises ─────────────────────────────────────

  /**
   * The placeholder is the setting, not decoration: an empty box means the
   * server prices the fourth pad like the third, which is what a null in
   * `joystick_price_4` has always meant.
   */
  test("the empty fourth box promises the third's price, and travels as null", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");

    expect(priceBoxFor(FOURTH).value).toBe("");
    expect(priceBoxFor(FOURTH).getAttribute("placeholder")).toBe("place.joystickFourthPlaceholder");

    await save();

    const body = await sent();
    expect(body.joystick_price).toBe(500);
    expect(body.joystick_price_4).toBeNull();
  });

  test("a figure in it overrides that promise", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");
    await type(FOURTH, "700");
    await save();

    expect((await sent()).joystick_price_4).toBe(700);
  });

  /**
   * Switching methods hides the other method's boxes; it does not throw away
   * what was typed in them. The payload is what decides — under one charge per
   * session no fourth figure is sent at all — so keeping the figure costs
   * nothing and saves the operator retyping it.
   */
  test("a figure typed for the fourth pad survives a trip through the other method", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");
    await type(FOURTH, "700");

    await pick(ONCE);
    await type("place.joystickPairPrice", "900");
    await save();
    expect((await sent()).joystick_price_4).toBeNull();

    await pick(EACH);
    expect(priceBoxFor(FOURTH).value).toBe("700");
  });

  test("a room that priced the pair apart reopens with both figures", async () => {
    await mount(place({
      joystick_charged_slots: "3,4", joystick_price: 500, joystick_price_4: 700, joystick_charge_mode: "each",
    }));

    expect(priceBoxFor(THIRD).value).toBe("500");
    expect(priceBoxFor(FOURTH).value).toBe("700");
  });
});
