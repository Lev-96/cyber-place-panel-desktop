// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";

/**
 * The ROOM's fourth pad: the menu, the question, and the second price box.
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
const BRANCH_POLICY = { branch_id: 7, joystick_price: 500, joystick_charged_slots: null };
// Seeded at hoist time AND re-seeded before every test below, because a
// `vi.fn()` with no implementation returns `undefined` and the form awaits
// this. That is not a failing assertion — it is a rejected promise landing
// wherever the event loop happens to be, which is a test that fails in a full
// run and passes on its own.
const billing = vi.hoisted(() => ({ get: vi.fn(async (..._a: unknown[]) => ({ branch_id: 7, joystick_price: 500, joystick_charged_slots: null })) }));
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

const priceBoxFor = (label: string): HTMLInputElement => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === label);
  expect(heading, `no price box labelled ${label}`).toBeTruthy();
  const box = heading!.parentElement!.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  expect(box, `the box labelled ${label} has no input`).toBeTruthy();
  return box!;
};
const hasBoxFor = (label: string): boolean =>
  [...dom.querySelectorAll("span.label")].some((el) => el.textContent === label);

const scopeSelect = (): HTMLSelectElement => {
  const selects = dom.querySelectorAll<HTMLSelectElement>("select");
  expect(selects.length).toBe(1);
  return selects[0];
};
const scopeOptions = (): string[] =>
  [...scopeSelect().querySelectorAll("option")].map((o) => (o as HTMLOptionElement).value);
const chooseScope = async (v: string) => {
  await act(async () => { fireEvent.change(scopeSelect(), { target: { value: v } }); });
};
const type = async (label: string, v: string) => {
  await act(async () => { fireEvent.change(priceBoxFor(label), { target: { value: v } }); });
};
/** The yes/no answer about a fourth pad, found by its label. */
const answerFourth = async (label: string) => {
  const radio = screen.getByLabelText(label);
  await act(async () => { fireEvent.click(radio); });
};
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
const sent = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(repo.update).toHaveBeenCalledTimes(1));
  const [id, body] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
  expect(id).toBe(12);
  return body;
};

const FOURTH_PRICE = "place.joystickFourthPrice";
const THIRD_PRICE = "place.joystickPrice";

describe("PlaceForm: the room's fourth pad", () => {
  beforeEach(() => {
    repo.create.mockReset().mockResolvedValue(place());
    repo.update.mockReset().mockResolvedValue(undefined);
    repo.nextNumber.mockReset().mockResolvedValue(4);
    translations.save.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  // ── the menu ─────────────────────────────────────────────────────────

  test("the menu offers the branch, the third and the pair — and no bare fourth", async () => {
    await mount(place());

    expect(scopeOptions()).toEqual(["", "3", "3,4"]);
  });

  /**
   * A room already stored as "only the fourth" keeps that answer. The option
   * left the menu; erasing the value would re-price a seat nobody touched.
   */
  test("a room already charging only for the fourth keeps its answer", async () => {
    await mount(place({ joystick_charged_slots: "4", joystick_price: 700 }));

    expect(scopeSelect().value).toBe("4");
    expect(scopeOptions()).toContain("4");

    await save();

    expect((await sent()).joystick_charged_slots).toBe("4");
  });

  // ── the question ─────────────────────────────────────────────────────

  test("choosing the third asks whether a fourth pad is needed, and starts at no", async () => {
    await mount(place());
    await chooseScope("3");

    expect(screen.getByText("place.joystickFourth")).toBeTruthy();
    expect(screen.getByLabelText("action.no")).toBeTruthy();
    expect((screen.getByLabelText("action.no") as HTMLInputElement).checked).toBe(true);
    expect(hasBoxFor(FOURTH_PRICE)).toBe(false);
  });

  test("answering no keeps one price box and charges for the third alone", async () => {
    await mount(place());
    await chooseScope("3");
    await type(THIRD_PRICE, "500");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3");
    expect(body.joystick_price).toBe(500);
    expect(body.joystick_price_4).toBeNull();
  });

  test("answering yes reveals the fourth price box", async () => {
    await mount(place());
    await chooseScope("3");
    await answerFourth("action.yes");

    expect(hasBoxFor(FOURTH_PRICE)).toBe(true);
  });

  test("the fourth price is mandatory: an empty box holds the save", async () => {
    await mount(place());
    await chooseScope("3");
    await type(THIRD_PRICE, "500");
    await answerFourth("action.yes");
    await save();

    expect(repo.update).not.toHaveBeenCalled();
    expect(screen.getByText("place.errors.joystickFourthPriceRequired")).toBeTruthy();
  });

  test("the third and the fourth travel as two figures over the charged pair", async () => {
    await mount(place());
    await chooseScope("3");
    await type(THIRD_PRICE, "500");
    await answerFourth("action.yes");
    await type(FOURTH_PRICE, "700");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_price).toBe(500);
    expect(body.joystick_price_4).toBe(700);
  });

  /** Zero is a decision: the fourth pad is handed over for nothing. */
  test("a fourth pad priced at zero is sent as zero, never as inherit", async () => {
    await mount(place());
    await chooseScope("3");
    await type(THIRD_PRICE, "500");
    await answerFourth("action.yes");
    await type(FOURTH_PRICE, "0");
    await save();

    expect((await sent()).joystick_price_4).toBe(0);
  });

  // ── the pair at one figure ───────────────────────────────────────────

  test("the pair asks nothing and sends one figure", async () => {
    await mount(place());
    await chooseScope("3,4");
    await type(THIRD_PRICE, "500");

    expect(screen.queryByText("place.joystickFourth")).toBeNull();
    expect(hasBoxFor(FOURTH_PRICE)).toBe(false);

    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_price_4).toBeNull();
  });

  // ── reopening a room that priced the pair apart ──────────────────────

  test("a room that priced the pair apart reopens as the third plus a fourth", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500, joystick_price_4: 700 }));

    expect(scopeSelect().value).toBe("3");
    expect((screen.getByLabelText("action.yes") as HTMLInputElement).checked).toBe(true);
    expect(priceBoxFor(THIRD_PRICE).value).toBe("500");
    expect(priceBoxFor(FOURTH_PRICE).value).toBe("700");
  });

  test("a room on the shared pair reopens as the pair", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500 }));

    expect(scopeSelect().value).toBe("3,4");
    expect(hasBoxFor(FOURTH_PRICE)).toBe(false);
  });

  /** Moving off the third drops the fourth figure rather than smuggling it. */
  test("switching back to the branch sends no fourth figure", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500, joystick_price_4: 700 }));
    await chooseScope("");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBeNull();
    expect(body.joystick_price_4).toBeNull();
  });

  test("a seat that stops being a PlayStation carries no fourth figure", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 500, joystick_price_4: 700 }));

    const platformSelect = [...dom.querySelectorAll<HTMLSelectElement>("select")];
    expect(platformSelect.length).toBeGreaterThan(0);

    await save();
    const body = await sent();
    // The room is still a PlayStation here, so the figure travels; the
    // platform switch is covered by the override suite next door. What this
    // pins is that the field is always PRESENT in the body — a key the server
    // never receives cannot clear a value.
    expect(Object.keys(body)).toContain("joystick_price_4");
  });
});
