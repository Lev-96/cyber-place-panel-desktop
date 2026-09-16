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
const chooseIncluded = async (v: string) => {
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

  test("a PlayStation place offers both boxes, on inherit by default", async () => {
    await mount(place());

    expect(screen.getByText("place.joystickIncluded")).toBeTruthy();
    expect(screen.getByText("place.joystickPrice")).toBeTruthy();
    // The copy has to name what an empty box falls back to, or "empty" reads
    // as "unset" and an operator fills it in to be safe.
    expect(screen.getByText("place.joystickOverrideNote")).toBeTruthy();
    expect(allowance().value).toBe("");
    expect(priceBox().value).toBe("");
    // Inherit, plus the four a seat can hold.
    expect(allowance().querySelectorAll("option").length).toBe(5);
  });

  test("both boxes left empty send null, which is inherit and not zero", async () => {
    await mount(place());
    await save();

    const body = await sent();
    expect(body.joystick_included).toBeNull();
    expect(body.joystick_price).toBeNull();
  });

  test("an override travels as numbers, for this place only", async () => {
    await mount(place());
    await chooseIncluded("3");
    await typePrice("700");
    await save();

    const body = await sent();
    expect(body.joystick_included).toBe(3);
    expect(body.joystick_price).toBe(700);
  });

  test("a seat that hands extra pads out free sends 0, not an empty override", async () => {
    await mount(place());
    await typePrice("0");
    await save();

    // 0 and null are different settings on the wire: this seat is free, it is
    // not a seat falling back to whatever the branch charges.
    const body = await sent();
    expect(body.joystick_price).toBe(0);
  });

  test("a saved override comes back in the boxes", async () => {
    // Decimal string, which is how the column reaches the panel on the
    // endpoints that serialise it that way.
    await mount(place({ joystick_included: 4, joystick_price: "250.00" }));

    expect(allowance().value).toBe("4");
    expect(priceBox().value).toBe("250");
  });

  test("a PC place is never asked the question", async () => {
    await mount(place({ platform: "pc" }));

    expect(screen.queryByText("place.joystickIncluded")).toBeNull();
    // No JOYSTICK price box. The seat still has its own hourly-rate box, which
    // every place has and which is a different question.
    expect(screen.queryByText("place.joystickPrice")).toBeNull();

    await save();
    const body = await sent();
    expect(body.joystick_included).toBeNull();
    expect(body.joystick_price).toBeNull();
  });

  test("a seat that stops being a PlayStation drops the override it had", async () => {
    await mount(place({ joystick_included: 4, joystick_price: 250 }));
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
