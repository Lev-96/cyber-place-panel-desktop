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
  useLang: () => ({
    // Keys come back as themselves, so an assertion names the key rather than
    // a sentence that may be rewritten. The ONE exception is the label the
    // operator's own word lands in: with the key returned verbatim there is no
    // `{0}` to fill, and the case that proves nothing is hardcoded would pass
    // against a component that never called `fmt`.
    t: (k: string) => (k === "place.extraItemEach" ? "charged every time ({0} × count)" : k),
    money: (n: number) => String(n),
    currency: "AMD",
    lang: "ru",
  }),
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
  repo.create.mockReset().mockResolvedValue({ id: 1 });
  repo.update.mockReset().mockResolvedValue({ id: 12 });
  repo.nextNumber.mockReset().mockResolvedValue(4);
  translations.save.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

const place = (over: Partial<IBranchPlace> = {}): IBranchPlace => ({
  id: 12,
  branch_id: 7,
  number: 3,
  name: "Table 3",
  type: "standard",
  status: "active",
  platform: "poker",
  subplatform_id: 1,
  games: [],
  ...over,
});

let dom: HTMLElement;

/**
 * The branch's custom platforms, already priced.
 *
 * Without this the form treats "poker" as a platform being invented right now
 * and asks for its three display names and a rate — a different screen from
 * the one these cases are about.
 */
const PRICED = [
  { id: 1, branch_id: 7, platform: "poker", name_en: "Poker", name_ru: "Покер", name_am: "Պոկեր", price_standard: 2000, price_vip: 3000 },
  { id: 2, branch_id: 7, platform: "billiards", name_en: "Billiards", name_ru: "Бильярд", name_am: "Բիլիարդ", price_standard: 2500, price_vip: 3500 },
] as unknown as Parameters<typeof PlaceForm>[0]["platformPrices"];

const mount = async (initial?: IBranchPlace) => {
  await act(async () => {
    const r = render(
      <PlaceForm branchId={7} initial={initial} platformPrices={PRICED} onClose={() => {}} onSaved={() => {}} />,
    );
    dom = r.container;
  });
};

/** The field the operator types the room's word into. */
const nameBox = (): HTMLInputElement | null =>
  dom.querySelector<HTMLInputElement>('input[placeholder="place.extraItemNamePlaceholder"]');

const priceBox = (): HTMLInputElement | null => {
  const heading = [...dom.querySelectorAll("span.label")]
    .find((el) => el.textContent === "place.extraItemPrice");
  return heading?.parentElement?.querySelector<HTMLInputElement>('input[inputmode="decimal"]') ?? null;
};

const save = async () => {
  const button = [...dom.querySelectorAll("button")].find((b) => b.textContent === "action.save");
  expect(button, "no save button").toBeTruthy();
  await act(async () => { fireEvent.click(button!); });
};

/**
 * A room on a CUSTOM platform hands out its own extra, in its own word.
 *
 * The PlayStation section answers the same question in the vocabulary of pads;
 * this is the version for a table that deals chips or lends a cue, and the
 * word is the operator's. Three things are worth pinning because each is
 * silent when it breaks: the section appears only where the server accepts it,
 * an empty name means "hands out nothing" rather than a half-written config,
 * and the charge mode is phrased with the operator's own word rather than with
 * a hardcoded noun.
 */
describe("the room's own extra", () => {
  test("a custom platform is asked what it hands out", async () => {
    await mount(place());

    expect(nameBox()).toBeTruthy();
  });

  test("a PlayStation is not asked — it prices pads instead", async () => {
    await mount(place({ platform: "ps5" }));

    expect(nameBox()).toBeNull();
  });

  test("a PC is not asked either", async () => {
    await mount(place({ platform: "pc" }));

    expect(nameBox()).toBeNull();
  });

  test("the charge question appears only once there is a thing to charge for", async () => {
    await mount(place());

    expect(dom.querySelector('[role="radiogroup"][aria-label="place.extraItemPayment"]')).toBeNull();

    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Фишки" } }); });

    expect(dom.querySelector('[role="radiogroup"][aria-label="place.extraItemPayment"]')).toBeTruthy();
  });

  test("the per-item label carries the operator's own word", async () => {
    await mount(place());
    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Кий" } }); });

    const group = dom.querySelector('[role="radiogroup"][aria-label="place.extraItemPayment"]')!;

    // `fmt` put the word where `{0}` was: nothing in this label is hardcoded.
    expect(group.textContent).toContain("Кий");
    expect(group.textContent).not.toContain("{0}");
  });

  test("a room that hands out nothing saves three nulls", async () => {
    await mount(place());
    await save();

    const body = repo.update.mock.calls[0][1] as Record<string, unknown>;

    expect(body.extra_item_name).toBeNull();
    expect(body.extra_item_price).toBeNull();
    expect(body.extra_item_charge_mode).toBeNull();
  });

  test("a configured room saves the word, the figure and the mode", async () => {
    await mount(place());

    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Фишки" } }); });
    await act(async () => { fireEvent.change(priceBox()!, { target: { value: "500" } }); });
    await save();

    const body = repo.update.mock.calls[0][1] as Record<string, unknown>;

    expect(body.extra_item_name).toBe("Фишки");
    expect(body.extra_item_price).toBe(500);
    expect(body.extra_item_charge_mode).toBe("each");
  });

  test("choosing once for the session is what is saved", async () => {
    await mount(place());

    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Кий" } }); });
    await act(async () => { fireEvent.change(priceBox()!, { target: { value: "700" } }); });

    const group = dom.querySelector('[role="radiogroup"][aria-label="place.extraItemPayment"]')!;
    const once = within(group as HTMLElement).getByText("place.extraItemOnce")
      .closest(".cp-choice")!
      .querySelector("input[type=radio]")!;
    await act(async () => { fireEvent.click(once); });
    await save();

    const body = repo.update.mock.calls[0][1] as Record<string, unknown>;

    expect(body.extra_item_charge_mode).toBe("once");
  });

  test("the tariff question appears with the rest, and defaults to fixed", async () => {
    await mount(place());
    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Кий" } }); });

    const group = dom.querySelector('[role="radiogroup"][aria-label="place.extraItemTariffChange"]');
    expect(group).toBeTruthy();

    const fixed = within(group as HTMLElement).getByText("joystickPrice.strategy.fixed")
      .closest(".cp-choice")!
      .querySelector<HTMLInputElement>("input[type=radio]")!;
    expect(fixed.checked).toBe(true);

    // The stated default sits above it, as it does for the pads.
    expect([...dom.querySelectorAll("span.pill")].some(
      (el) => el.textContent === "place.extraItemStrategyFixed",
    )).toBe(true);
  });

  test("choosing the hourly tariff is what is saved", async () => {
    await mount(place());
    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Кий" } }); });
    await act(async () => { fireEvent.change(priceBox()!, { target: { value: "700" } }); });

    const group = dom.querySelector('[role="radiogroup"][aria-label="place.extraItemTariffChange"]')!;
    const hourly = within(group as HTMLElement).getByText("joystickPrice.strategy.hourly")
      .closest(".cp-choice")!
      .querySelector("input[type=radio]")!;
    await act(async () => { fireEvent.click(hourly); });
    await save();

    const body = repo.update.mock.calls[0][1] as Record<string, unknown>;

    expect(body.extra_item_pricing_mode).toBe("hourly");
  });

  test("an existing hourly room comes back on the hourly answer", async () => {
    await mount(place({
      extra_item_name: "Кий",
      extra_item_price: 700,
      extra_item_charge_mode: "each",
      extra_item_pricing_mode: "hourly",
    }));

    const group = dom.querySelector('[role="radiogroup"][aria-label="place.extraItemTariffChange"]')!;
    const hourly = within(group as HTMLElement).getByText("joystickPrice.strategy.hourly")
      .closest(".cp-choice")!
      .querySelector<HTMLInputElement>("input[type=radio]")!;

    expect(hourly.checked).toBe(true);
  });

  test("a room that hands out nothing saves a null tariff too", async () => {
    await mount(place());
    await save();

    const body = repo.update.mock.calls[0][1] as Record<string, unknown>;

    expect(body.extra_item_pricing_mode).toBeNull();
  });

  test("a name with no price holds the save rather than guessing one", async () => {
    await mount(place());
    await act(async () => { fireEvent.change(nameBox()!, { target: { value: "Фишки" } }); });
    await save();

    expect(repo.update).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(dom.querySelector(".error")?.textContent).toBe("place.errors.extraPriceRequired");
    });
  });

  test("an existing configuration comes back into the form", async () => {
    await mount(place({
      extra_item_name: "Дротики",
      extra_item_price: 300,
      extra_item_charge_mode: "once",
    }));

    expect(nameBox()!.value).toBe("Дротики");
    expect(priceBox()!.value).toBe("300");

    const group = dom.querySelector('[role="radiogroup"][aria-label="place.extraItemPayment"]')!;
    const once = within(group as HTMLElement).getByText("place.extraItemOnce")
      .closest(".cp-choice")!
      .querySelector<HTMLInputElement>("input[type=radio]")!;

    expect(once.checked).toBe(true);
  });

  test("a seat that stops being custom stops carrying an extra", async () => {
    await mount(place({ extra_item_name: "Фишки", extra_item_price: 500 }));

    // The picker's PlayStation button; the platform question is the panel's,
    // and the payload must follow it rather than the stale state behind it.
    const ps = [...dom.querySelectorAll("button")].find((b) => b.textContent === "PS5");
    expect(ps, "no PS5 button on the platform picker").toBeTruthy();
    await act(async () => { fireEvent.click(ps!); });
    await save();

    const body = repo.update.mock.calls[0]?.[1] as Record<string, unknown> | undefined;

    if (body) {
      expect(body.extra_item_name).toBeNull();
      expect(body.extra_item_price).toBeNull();
      expect(body.extra_item_charge_mode).toBeNull();
    }
  });
});
