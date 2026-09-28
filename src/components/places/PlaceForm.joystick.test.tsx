// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";

/**
 * The room's joystick settings, as the form asks them since 2026-09-18.
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

// Every describe below mounts the form, and the form asks the venue for its
// joystick policy. One seeding, in one place, so no block can forget it.
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

/** A price box, found by the label above it rather than by being the only one. */
const priceBoxFor = (label: string): HTMLInputElement => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === label);
  expect(heading, `no price box labelled ${label}`).toBeTruthy();
  const box = heading!.parentElement!.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  expect(box, `the box labelled ${label} has no input`).toBeTruthy();
  return box!;
};
const hasBoxFor = (label: string): boolean =>
  [...dom.querySelectorAll("span.label")].some((el) => el.textContent === label);

const INHERIT = "place.joystickInherit";
const EACH = "joystickPrice.chargeMode.each";
const ONCE = "joystickPrice.chargeMode.once";
const THIRD = "place.joystickThirdPrice";
const FOURTH = "place.joystickFourthPrice";
const PAIR = "place.joystickPairPrice";
const BRANCH_BOX = "place.joystickPrice";

/**
 * The room's own decision group. "As in the branch" is the label of a radio in
 * two different groups — this one and the tariff one below — so every click is
 * scoped to the group it belongs to rather than to the first match in the DOM.
 */
const modeGroup = (): HTMLElement => {
  const group = dom.querySelector<HTMLElement>('[role="radiogroup"][aria-label="place.joysticks"]');
  expect(group, "the room's decision is a radiogroup").toBeTruthy();
  return group!;
};
const paymentGroup = (): HTMLElement => {
  const group = dom.querySelector<HTMLElement>('[role="radiogroup"][aria-label="place.joystickPayment"]');
  expect(group, "the payment method is a radiogroup").toBeTruthy();
  return group!;
};
const tariffGroup = (): HTMLElement => {
  const group = dom.querySelector<HTMLElement>('[role="radiogroup"][aria-label="place.joystickTariffChange"]');
  expect(group, "the tariff question is a radiogroup").toBeTruthy();
  return group!;
};
const radioIn = (group: HTMLElement, label: string): HTMLInputElement =>
  within(group).getByLabelText(label) as HTMLInputElement;
const pick = async (label: string) => {
  const group = label === INHERIT ? modeGroup() : paymentGroup();
  await act(async () => { fireEvent.click(radioIn(group, label)); });
};
const pickTariff = async (label: string) => {
  await act(async () => { fireEvent.click(radioIn(tariffGroup(), label)); });
};
const type = async (label: string, v: string) => {
  await act(async () => { fireEvent.change(priceBoxFor(label), { target: { value: v } }); });
};
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
const sent = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(repo.update).toHaveBeenCalledTimes(1), { timeout: 5000 });
  const [id, body] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
  expect(id).toBe(12);
  return body;
};

describe("PlaceForm joystick settings", () => {
  beforeEach(() => {
    repo.create.mockReset().mockResolvedValue(place());
    repo.update.mockReset().mockResolvedValue(undefined);
    repo.nextNumber.mockReset().mockResolvedValue(4);
    translations.save.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  // ── what the form asks ───────────────────────────────────────────────

  test("a PlayStation seat follows its branch by default, and says so", async () => {
    await mount(place());

    expect(radioIn(modeGroup(), INHERIT).checked).toBe(true);
    expect(screen.getByText("place.joysticks")).toBeTruthy();
    expect(screen.getByText("place.joystickPayment")).toBeTruthy();
  });

  /** The select that used to ask which pads are charged is gone entirely. */
  test("the form has no charged-pads menu any more", async () => {
    await mount(place());

    expect(dom.querySelectorAll("select").length).toBe(0);
    expect(screen.queryByText("place.joystickScope")).toBeNull();
  });

  test("the branch's figure is shown, and cannot be typed into", async () => {
    await mount(place());

    const box = priceBoxFor(BRANCH_BOX);
    expect(box.value).toBe("500");
    expect(box.disabled).toBe(true);
  });

  test("following the branch sends every column null, which is inherit and not zero", async () => {
    await mount(place());
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBeNull();
    expect(body.joystick_price).toBeNull();
    expect(body.joystick_price_4).toBeNull();
  });

  // ── charged for every handout ────────────────────────────────────────

  test("the per-handout method opens two boxes, and the fourth promises to follow the third", async () => {
    await mount(place());
    await pick(EACH);

    expect(priceBoxFor(THIRD).getAttribute("placeholder")).toBe("place.joystickThirdPlaceholder");
    expect(priceBoxFor(FOURTH).getAttribute("placeholder")).toBe("place.joystickFourthPlaceholder");
    expect(hasBoxFor(PAIR)).toBe(false);
  });

  test("a third price alone travels as the pair with no fourth figure", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");
    await save();

    const body = await sent();
    expect(body.joystick_charge_mode).toBe("each");
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_price).toBe(500);
    expect(body.joystick_price_4).toBeNull();
  });

  test("a fourth price of its own travels beside the third", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");
    await type(FOURTH, "700");
    await save();

    const body = await sent();
    expect(body.joystick_price).toBe(500);
    expect(body.joystick_price_4).toBe(700);
  });

  /** Zero is a decision: that pad is handed over for nothing. */
  test("a zero travels as zero, never as inherit", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");
    await type(FOURTH, "0");
    await save();

    expect((await sent()).joystick_price_4).toBe(0);
  });

  // ── one charge per session ───────────────────────────────────────────

  test("the once-per-session method opens one box for the pair", async () => {
    await mount(place());
    await pick(ONCE);

    expect(priceBoxFor(PAIR).getAttribute("placeholder")).toBe("place.joystickPairPlaceholder");
    expect(hasBoxFor(THIRD)).toBe(false);
    expect(hasBoxFor(FOURTH)).toBe(false);
  });

  test("the pair's figure travels as the room's price, with no fourth figure", async () => {
    await mount(place());
    await pick(ONCE);
    await type(PAIR, "900");
    await save();

    const body = await sent();
    expect(body.joystick_charge_mode).toBe("once");
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_price).toBe(900);
    expect(body.joystick_price_4).toBeNull();
  });

  // ── switching between them ───────────────────────────────────────────

  test("switching methods swaps the boxes and leaves no incompatible pair on screen", async () => {
    await mount(place());

    await pick(EACH);
    expect(hasBoxFor(THIRD)).toBe(true);
    expect(hasBoxFor(PAIR)).toBe(false);

    await pick(ONCE);
    expect(hasBoxFor(THIRD)).toBe(false);
    expect(hasBoxFor(FOURTH)).toBe(false);
    expect(hasBoxFor(PAIR)).toBe(true);

    await pick(EACH);
    expect(hasBoxFor(THIRD)).toBe(true);
    expect(hasBoxFor(FOURTH)).toBe(true);
    expect(hasBoxFor(PAIR)).toBe(false);
  });

  /** A fourth figure typed under one method must not survive into the other. */
  test("switching to one charge per session drops the fourth figure", async () => {
    await mount(place());
    await pick(EACH);
    await type(THIRD, "500");
    await type(FOURTH, "700");
    await pick(ONCE);
    await type(PAIR, "900");
    await save();

    const body = await sent();
    expect(body.joystick_price).toBe(900);
    expect(body.joystick_price_4).toBeNull();
  });

  test("going back to the branch clears what the room had named", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500, joystick_charge_mode: "each" }));
    await pick(INHERIT);
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBeNull();
    expect(body.joystick_price).toBeNull();
    expect(body.joystick_charge_mode).toBeNull();
  });

  // ── a price is mandatory once the room prices its own pads ───────────

  test("picking a method with no figure holds the save", async () => {
    await mount(place());
    await pick(EACH);
    await save();

    expect(repo.update).not.toHaveBeenCalled();
    expect(screen.getByText("place.errors.joystickPriceRequired")).toBeTruthy();
  });

  test("the same is true of one charge per session", async () => {
    await mount(place());
    await pick(ONCE);
    await save();

    expect(repo.update).not.toHaveBeenCalled();
  });

  // ── rooms that were saved before this form existed ───────────────────

  test("a room saved with a per-handout fee reopens on it, with its figures", async () => {
    await mount(place({
      joystick_charged_slots: "3,4", joystick_price: 500, joystick_price_4: 700, joystick_charge_mode: "each",
    }));

    expect(radioIn(paymentGroup(), EACH).checked).toBe(true);
    expect(priceBoxFor(THIRD).value).toBe("500");
    expect(priceBoxFor(FOURTH).value).toBe("700");
  });

  test("a room saved with one charge per session reopens on it", async () => {
    await mount(place({
      joystick_charged_slots: "3,4", joystick_price: 900, joystick_charge_mode: "once",
    }));

    expect(radioIn(paymentGroup(), ONCE).checked).toBe(true);
    expect(priceBoxFor(PAIR).value).toBe("900");
  });

  /**
   * ⚠️ A room that prices its pads and inherited the charge mode keeps
   * inheriting it. Writing "each" here would start charging per pad at a venue
   * that charges once — a price change nobody asked for, on save.
   */
  test("a room that never answered the charge mode still sends null for it", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500 }));
    await save();

    expect((await sent()).joystick_charge_mode).toBeNull();
  });

  /** …and a narrower stored shape is carried through rather than widened. */
  test("a room charging for one pad only keeps that until a method is picked", async () => {
    await mount(place({ joystick_charged_slots: "3", joystick_price: 500 }));
    await save();

    expect((await sent()).joystick_charged_slots).toBe("3");
  });

  /** Re-pricing it is not re-shaping it: the room still charges for one pad. */
  test("a new figure alone leaves the narrower shape alone", async () => {
    await mount(place({ joystick_charged_slots: "3", joystick_price: 500 }));
    await type(THIRD, "600");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3");
    expect(body.joystick_price).toBe(600);
  });

  /** Choosing a method deliberately IS re-shaping it, and says so on screen. */
  test("choosing a method replaces the narrower shape with the pair", async () => {
    await mount(place({ joystick_charged_slots: "3", joystick_price: 500 }));
    await pick(ONCE);
    await type(PAIR, "900");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_charge_mode).toBe("once");
    expect(body.joystick_price).toBe(900);
  });

  test("a room on the narrower shape is told so", async () => {
    await mount(place({ joystick_charged_slots: "3", joystick_price: 500 }));

    expect(screen.getByText("place.joystickLegacySlotsNote")).toBeTruthy();
  });

  // ── the tariff, and the seat that is not a PlayStation ───────────────

  test("the tariff states the default and offers no choice", async () => {
    await mount(place());

    expect(screen.getByText("place.joystickStrategy")).toBeTruthy();
    expect(screen.getByText("place.joystickStrategyFixed")).toBeTruthy();
    expect(within(dom).queryAllByLabelText("joystickPrice.strategy.fixed").length).toBe(1);
  });

  /**
   * Two answers and no "as in the branch": the room states the tariff it bills
   * a pad on. Fixed is the default, which is what every venue bills by.
   */
  test("the tariff question offers two answers, fixed by default", async () => {
    await mount(place());

    const group = tariffGroup();
    expect(group.querySelectorAll('input[type="radio"]').length).toBe(2);
    expect(within(group).queryByLabelText(INHERIT)).toBeNull();
    expect(radioIn(group, "joystickPrice.strategy.fixed").checked).toBe(true);
    expect(radioIn(group, "joystickPrice.strategy.hourly").checked).toBe(false);
  });

  /**
   * A place being CREATED has no tariff behind it to be moved off, so it opens
   * on the default whatever the venue bills by.
   */
  test("a new place defaults to the fixed tariff, even at an hourly venue", async () => {
    billing.get.mockResolvedValue({ ...BRANCH_POLICY, joystick_pricing_mode: "hourly" });
    await mount();
    // A place is created on PC and becomes a PlayStation when the operator
    // picks one, which is when the joystick block appears at all.
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "PS5" })); });

    expect(radioIn(tariffGroup(), "joystickPrice.strategy.fixed").checked).toBe(true);
    expect(radioIn(tariffGroup(), "joystickPrice.strategy.hourly").checked).toBe(false);
  });

  /**
   * ⚠️ A room that never answered opens on the answer it INHERITS, not on the
   * default: a screen showing "fixed" to a room billing hourly through its
   * branch would be a lie about money, and saving it would make the lie true.
   */
  test("a room with no answer of its own opens on the venue's", async () => {
    billing.get.mockResolvedValue({ ...BRANCH_POLICY, joystick_pricing_mode: "hourly" });
    await mount(place());

    expect(radioIn(tariffGroup(), "joystickPrice.strategy.hourly").checked).toBe(true);
  });

  test("a room that stated its own keeps it", async () => {
    billing.get.mockResolvedValue({ ...BRANCH_POLICY, joystick_pricing_mode: "hourly" });
    await mount(place({ joystick_pricing_mode: "fixed" }));

    expect(radioIn(tariffGroup(), "joystickPrice.strategy.fixed").checked).toBe(true);
  });

  test("what the room picks for the tariff is what the server is told", async () => {
    await mount(place());
    await pickTariff("joystickPrice.strategy.hourly");
    await save();

    expect((await sent()).joystick_pricing_mode).toBe("hourly");
  });

  /** The tariff is always stated — for a fresh room that is the default. */
  test("the tariff travels stated, never empty", async () => {
    await mount(place());
    await save();

    expect((await sent()).joystick_pricing_mode).toBe("fixed");
  });

  /** …and for a room that inherited one, it is the figure it already billed by. */
  test("an inherited tariff travels as the one it was already billing by", async () => {
    billing.get.mockResolvedValue({ ...BRANCH_POLICY, joystick_pricing_mode: "hourly" });
    await mount(place());
    await save();

    expect((await sent()).joystick_pricing_mode).toBe("hourly");
  });

  test("a PC seat still states none of it", async () => {
    await mount(place({ platform: "pc" }));
    await save();

    expect((await sent()).joystick_pricing_mode).toBeNull();
  });

  test("a PC seat is asked none of it", async () => {
    await mount(place({ platform: "pc" }));

    expect(screen.queryByText("place.joysticks")).toBeNull();
    expect(screen.queryByText("place.joystickPayment")).toBeNull();
    expect(screen.queryByText("place.joystickStrategy")).toBeNull();
  });

  test("a seat that stops being a PlayStation drops the override it had", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500, joystick_charge_mode: "each" }));

    const platformBox = dom.querySelector<HTMLInputElement>('input[list]')
      ?? dom.querySelector<HTMLInputElement>('input[name="platform"]');
    if (platformBox) {
      await act(async () => { fireEvent.change(platformBox, { target: { value: "pc" } }); });
      await save();

      const body = await sent();
      expect(body.joystick_charged_slots).toBeNull();
      expect(body.joystick_price).toBeNull();
      expect(body.joystick_charge_mode).toBeNull();
    }
  });
});
