// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";

/**
 * The per-place joystick override.
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

/**
 * The override's price box. A PlayStation place on a Default sub-category has
 * no rate field of its own, so the joystick fee used to be the form's only
 * `PriceInput`. It is not any more — the seat's own price per hour sits above
 * it — so the box is found by its LABEL rather than by being the only one.
 * Counting was what made this helper wrong the moment a second price appeared.
 */
const priceBoxes = () => dom.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]');
const priceBoxFor = (label: string): HTMLInputElement => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === label);
  expect(heading, `no price box labelled ${label}`).toBeTruthy();
  const box = heading!.parentElement!.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  expect(box, `the box labelled ${label} has no input`).toBeTruthy();
  return box!;
};
const priceBox = () => priceBoxFor("place.joystickPrice");
/** The allowance select. `SubplatformTabs` is mocked away, so there is one. */
const allowances = () => dom.querySelectorAll<HTMLSelectElement>("select");
const allowance = () => {
  expect(allowances().length).toBe(1);
  return allowances()[0];
};
const typePrice = async (v: string) => {
  await act(async () => { fireEvent.change(priceBox(), { target: { value: v } }); });
};
const chooseScope = async (v: string) => {
  await act(async () => { fireEvent.change(allowance(), { target: { value: v } }); });
};
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
/** The body the form handed to `placeRepository.update`. */
const sent = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(repo.update).toHaveBeenCalledTimes(1));
  const [id, body] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
  expect(id).toBe(12);
  return body;
};

describe("PlaceForm joystick override", () => {
  beforeEach(() => {
    repo.create.mockReset().mockResolvedValue(place());
    repo.update.mockReset().mockResolvedValue(undefined);
    repo.nextNumber.mockReset().mockResolvedValue(4);
    translations.save.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  test("a PlayStation place asks which pads it charges for, on the branch by default", async () => {
    await mount(place());

    expect(screen.getByText("place.joystickScope")).toBeTruthy();
    expect(screen.getByText("place.joystickPrice")).toBeTruthy();
    // The copy has to name what the untouched answer falls back to, or
    // "empty" reads as "unset" and an operator fills it in to be safe.
    expect(screen.getByText("place.joystickBranchNote")).toBeTruthy();
    expect(allowance().value).toBe("");
  });

  /**
   * The menu is the controllers by NUMBER, not a count of pads.
   *
   * It offered 1, 2, 3 and 4 — an allowance — which asked a PlayStation seat
   * how many of its two built-in controllers were included, and could not
   * express "the third and not the fourth" at all.
   */
  /**
   * The bare fourth left the menu on 2026-09-17: it answered a question no
   * venue asked, and it sat beside "3" and "3,4" as a third shape to reason
   * about. A room that sells a fourth pad now says so under "3", with a price
   * of its own — see `PlaceForm.fourthJoystick.test.tsx`, which also pins that
   * a room already stored on "4" keeps it.
   */
  test("the menu names the third and the pair, and nothing else", async () => {
    await mount(place());

    const options = [...allowance().querySelectorAll("option")].map((o) => o.value);
    expect(options).toEqual(["", "3", "3,4"]);
  });

  /**
   * Under "as the branch does" the box is READ-ONLY.
   *
   * The figure it shows was decided on another screen, and an editable box
   * that silently discards what is typed into it is worse than no box.
   */
  test("the price box is read-only while the room follows its branch", async () => {
    await mount(place());

    expect(priceBox().disabled).toBe(true);
  });

  /**
   * …and it shows the VENUE's figure, which is the one that will be charged.
   *
   * The whole point of the read-only state: an operator looking at a seat set
   * to "as the branch does" can see what that costs without leaving the form
   * for another screen.
   */
  test("the read-only box shows the branch's own fee", async () => {
    await mount(place());

    await waitFor(() => expect(priceBox().value).toBe("500"));
  });

  /** …and it opens the moment the room names pads of its own. */
  test("naming pads of its own opens the price box", async () => {
    await mount(place());
    await chooseScope("3");

    expect(priceBox().disabled).toBe(false);
    expect(screen.getByText("place.joystickOwnNote")).toBeTruthy();
  });

  test("following the branch sends every column null, which is inherit and not zero", async () => {
    await mount(place());
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBeNull();
    expect(body.joystick_included).toBeNull();
    expect(body.joystick_price).toBeNull();
  });

  test("a room's own answer travels as the slots and the figure", async () => {
    await mount(place());
    await chooseScope("3,4");
    await typePrice("700");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_price).toBe(700);
  });

  /**
   * A FRESH room cannot be put on the bare fourth any more — the option is not
   * in the menu to choose. The stored answer is a different question, and the
   * suite next door pins that it survives untouched.
   */
  test("a fresh room cannot be put on the bare fourth", async () => {
    await mount(place());

    const options = [...allowance().querySelectorAll("option")].map((o) => o.value);
    expect(options).not.toContain("4");
  });

  test("a seat that hands its named pads out free sends 0, not an empty override", async () => {
    await mount(place());
    await chooseScope("3");
    await typePrice("0");
    await save();

    // 0 and null are different settings on the wire: this seat gives its third
    // pad away, it is not a seat falling back to whatever the branch charges.
    const body = await sent();
    expect(body.joystick_price).toBe(0);
  });

  test("a saved answer comes back in the boxes", async () => {
    // Decimal string, which is how the column reaches the panel on the
    // endpoints that serialise it that way.
    await mount(place({ joystick_charged_slots: "4", joystick_price: "250.00" }));

    expect(allowance().value).toBe("4");
    expect(priceBox().value).toBe("250");
    expect(priceBox().disabled).toBe(false);
  });

  /**
   * Switching back to the branch drops the room's answer rather than leaving
   * half of it behind — a seat with a price and no slots is the older shape,
   * and choosing "as the branch does" is not a way to arrive at it.
   */
  test("switching back to the branch clears what the room had named", async () => {
    await mount(place({ joystick_charged_slots: "3", joystick_price: 700 }));
    await chooseScope("");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBeNull();
    expect(body.joystick_price).toBeNull();
    expect(body.joystick_included).toBeNull();
  });

  /**
   * A room already on the older answer keeps it.
   *
   * Its setting has no name on this menu, so the menu grows one for it rather
   * than translating a count into slots nobody chose. Saving without touching
   * it must re-price nothing.
   */
  test("a room on the older count keeps it until it picks something else", async () => {
    await mount(place({ joystick_included: 3, joystick_price: "250.00" }));

    expect(allowance().value).toBe("legacy");
    expect(priceBox().disabled).toBe(true);

    await save();
    const body = await sent();
    expect(body.joystick_charged_slots).toBeNull();
    expect(body.joystick_included).toBe(3);
    expect(body.joystick_price).toBe(250);
  });

  /** …and picking one of the three replaces it outright. */
  test("picking an answer replaces the older one", async () => {
    await mount(place({ joystick_included: 3, joystick_price: "250.00" }));
    await chooseScope("3,4");
    await typePrice("700");
    await save();

    const body = await sent();
    expect(body.joystick_charged_slots).toBe("3,4");
    expect(body.joystick_price).toBe(700);
  });

  test("a PC place is never asked the question", async () => {
    await mount(place({ platform: "pc" }));

    expect(screen.queryByText("place.joystickScope")).toBeNull();
    // No JOYSTICK price box. The seat still has its own hourly-rate box, which
    // every place has and which is a different question.
    expect(screen.queryByText("place.joystickPrice")).toBeNull();

    await save();
    const body = await sent();
    expect(body.joystick_included).toBeNull();
    expect(body.joystick_price).toBeNull();
  });

  test("a seat that stops being a PlayStation drops the override it had", async () => {
    await mount(place({ joystick_charged_slots: "3,4", joystick_price: 250 }));
    // The picker's own button, the way an operator moves a seat to another
    // platform. The boxes go with the question.
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "PC" })); });
    expect(screen.queryByText("place.joystickPrice")).toBeNull();

    await save();
    const body = await sent();
    // Null, not the stale 4/250: a PC seat carrying a joystick override is a
    // rule nobody can see and nothing would apply.
    expect(body.joystick_included).toBeNull();
    expect(body.joystick_price).toBeNull();
  });
});

/**
 * The room's pricing answers, which moved here from the branch's Prices page.
 *
 * What a pad costs, HOW it is priced and HOW OFTEN it is charged are answers a
 * ROOM gives — a club sells its VIP's controllers differently from its floor's
 * — so they are set where that room's rate is set, by the same owner-level
 * permission, and inherit the branch until the room says otherwise.
 */
describe("the room's own joystick pricing", () => {
  const radio = (name: string) =>
    screen.getByRole("radio", { name }) as HTMLInputElement;
  const pick = async (name: string) => {
    await act(async () => { fireEvent.click(radio(name)); });
  };

  beforeEach(() => {
    repo.create.mockReset();
    repo.update.mockReset();
    repo.create.mockResolvedValue({ id: 12 });
    repo.update.mockResolvedValue({ id: 12 });
    repo.nextNumber.mockResolvedValue(3);
  });
  afterEach(cleanup);

  test("a PlayStation room offers both questions, on inherit by default", async () => {
    await mount(place());

    expect(screen.getByText("place.joystickStrategy")).toBeTruthy();
    expect(screen.getByText("place.joystickChargeMode")).toBeTruthy();
    // Two groups, each with its own "follow the branch" answer selected.
    const inherits = screen.getAllByRole("radio", { name: "place.joystickInherit" }) as HTMLInputElement[];
    expect(inherits.length).toBe(2);
    expect(inherits.every((i) => i.checked)).toBe(true);
  });

  /** Exactly two strategies, and the retired third is not among them. */
  test("the strategy offers the two answers and no others", async () => {
    await mount(place());

    expect(radio("joystickPrice.strategy.fixed")).toBeTruthy();
    expect(radio("joystickPrice.strategy.hourly")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /both/i })).toBeNull();
  });

  /** The charge mode says what it DOES, not which slot number it is. */
  test("the charge mode is named for what it does", async () => {
    await mount(place());

    expect(radio("joystickPrice.chargeMode.each")).toBeTruthy();
    expect(radio("joystickPrice.chargeMode.once")).toBeTruthy();
    // The slot numbers the old screen printed are gone from this form.
    expect(screen.queryByText("3/4")).toBeNull();
  });

  test("untouched, both travel as null — which is inherit and not a setting", async () => {
    await mount(place());
    await save();

    const body = await sent();
    expect(body.joystick_pricing_mode).toBeNull();
    expect(body.joystick_charge_mode).toBeNull();
  });

  test("what the room picks is what the server is told", async () => {
    await mount(place());

    await pick("joystickPrice.strategy.hourly");
    await pick("joystickPrice.chargeMode.once");
    await save();

    const body = await sent();
    expect(body.joystick_pricing_mode).toBe("hourly");
    expect(body.joystick_charge_mode).toBe("once");
  });

  test("a saved answer comes back selected", async () => {
    await mount(place({
      joystick_pricing_mode: "hourly", joystick_charge_mode: "once",
    } as Partial<IBranchPlace>));

    expect(radio("joystickPrice.strategy.hourly").checked).toBe(true);
    expect(radio("joystickPrice.chargeMode.once").checked).toBe(true);
    expect(radio("joystickPrice.strategy.fixed").checked).toBe(false);
  });

  /** A seat with no pads is never asked about how they are priced. */
  test("a PC room is asked neither question", async () => {
    await mount(place({ platform: "pc" }));

    expect(screen.queryByText("place.joystickStrategy")).toBeNull();
    expect(screen.queryByText("place.joystickChargeMode")).toBeNull();
  });
});
