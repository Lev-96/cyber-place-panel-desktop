// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IBillingSettings } from "@/api/joystickPrices";
import JoystickPricesForm from "./JoystickPricesForm";

/**
 * One fee for every extra joystick, and the three things a venue can decide
 * about those joysticks.
 *
 * It was three inputs — the second pad, the third and the fourth — because the
 * schema could express three prices. No venue ever set them differently, so the
 * screen asked an operator three questions with a single answer and left two of
 * them to be forgotten: fill in only the first, and the "+" button refused the
 * third pad with a sentence about a slot nobody had thought about.
 *
 * What this file pins now:
 *
 *  - the form writes the WHOLE billing policy (it shares a PUT with the
 *    rounding rule, and sending half of it would blank the other half);
 *  - each of the wire's three states has a NAMED choice, and the two that used
 *    to share one box do not collide: Free sends `0`, Not offered sends `null`,
 *    and a stored figure is read back as the choice that produced it;
 *  - "Charged" with nothing typed is not an answer and never reaches the
 *    server as a guess.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  // `currency` and `lang` are what PriceInput reads; AMD keeps the box's
  // displayed figure identical to the stored one, so an assertion about "500"
  // is about this form and not about an exchange rate.
  useLang: () => ({ t: (k: string) => k, currency: "AMD", lang: "ru" }),
}));

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7,
  money_rounding_step: 100,
  money_rounding_mode: "nearest",
  joystick_price: 300,
  ...over,
});

let dom: HTMLElement;

const mount = async (s: IBillingSettings = settings()) => {
  await act(async () => {
    const r = render(<JoystickPricesForm branchId={7} settings={s} onSaved={() => {}} />);
    dom = r.container;
  });
};

// The price box. `PriceInput` renders its label as a sibling span rather than a
// real <label>, so there is nothing to query by label text — and "the one box"
// is an assertion this file is making anyway. Selected by type, because the
// choice above it is made of radios and those are inputs too.
const boxes = () => dom.querySelectorAll<HTMLInputElement>('input[type="text"]');
const box = () => {
  expect(boxes().length).toBe(1);
  return boxes()[0];
};
const save = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
/**
 * The form has two selects, in the order the operator reads them: HOW a pad is
 * priced, then WHICH pads carry that price.
 */
const strategy = () => {
  const selects = dom.querySelectorAll("select");
  expect(selects.length).toBe(2);
  return selects[0] as HTMLSelectElement;
};
const allowance = () => {
  const selects = dom.querySelectorAll("select");
  expect(selects.length).toBe(2);
  return selects[1] as HTMLSelectElement;
};
const chooseStrategy = async (v: string) => {
  await act(async () => { fireEvent.change(strategy(), { target: { value: v } }); });
};
const chooseSlots = async (v: string) => {
  await act(async () => { fireEvent.change(allowance(), { target: { value: v } }); });
};
const type = async (v: string) => {
  await act(async () => { fireEvent.change(box(), { target: { value: v } }); });
};
/** One of the three named choices, by the label an operator reads. */
const choice = (m: "Paid" | "Free" | "None") =>
  screen.getByRole("radio", { name: `joystickPrice.extra${m}` }) as HTMLInputElement;
const choose = async (m: "Paid" | "Free" | "None") => {
  await act(async () => { fireEvent.click(choice(m)); });
};
/** The club's allowed-strategies answer, by the label an operator reads. */
const clubRadio = (m: "change_tariff" | "fixed_price" | "both") =>
  screen.getByRole("radio", { name: `joystickPrice.clubMode.${m}` }) as HTMLInputElement;
const pickClubMode = async (m: "change_tariff" | "fixed_price" | "both") => {
  await act(async () => { fireEvent.click(clubRadio(m)); });
};
/** The "will you hand out a fourth?" answer, by the word an operator reads. */
const radio = (a: "yes" | "no") =>
  screen.getByRole("radio", { name: `joystickPrice.${a}` }) as HTMLInputElement;
const answerFourth = async (a: "yes" | "no") => {
  await act(async () => { fireEvent.click(radio(a)); });
};
/** By position, because the two price boxes are told apart by their order. */
const typeIn = async (i: number, v: string) => {
  await act(async () => { fireEvent.change(boxes()[i], { target: { value: v } }); });
};

describe("JoystickPricesForm", () => {
  beforeEach(() => repo.update.mockReset().mockResolvedValue(settings()));
  afterEach(cleanup);

  test("a priced venue opens on Charged, with one box holding its fee", async () => {
    await mount();

    expect(choice("Paid").checked).toBe(true);
    expect(box().value).toBe("300");
    expect(screen.getByText("joystickPrice.priceShared")).toBeTruthy();
    // The per-slot inputs are gone. Their label was "Joystick #N", which is the
    // string a re-introduction would bring back with it.
    expect(screen.queryByText(/joystickPrice\.slot/)).toBeNull();
  });

  test("saves the fee, and the rounding policy along with it", async () => {
    await mount();
    await type("500");
    await act(async () => { fireEvent.click(save()); });

    // Step and mode go back untouched. This is a PUT of the whole policy, so a
    // form that sent only its own field would clear the venue's rounding.
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 500,
      joystick_included: 1,
      joystick_charged_slots: null,
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  // ── the three choices, and the two that used to share one box ─────────

  test("Free sends a zero fee, not a withdrawn offer", async () => {
    await mount();
    await choose("Free");

    // No box: under Free there is no figure to give, and a box that cannot
    // mean anything is a box that gets filled in.
    expect(boxes().length).toBe(0);
    expect(screen.getByText("joystickPrice.freeNote")).toBeTruthy();

    await act(async () => { fireEvent.click(save()); });
    // 0, never null. A free pad is still handed out, still counted and still a
    // line on the bill; null is the venue not offering pads at all.
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 0,
      joystick_included: 1,
      joystick_charged_slots: null,
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  test("Not offered withdraws the offer rather than pricing it at zero", async () => {
    await mount();
    await choose("None");

    expect(boxes().length).toBe(0);
    expect(screen.getByText("joystickPrice.noneNote")).toBeTruthy();

    await act(async () => { fireEvent.click(save()); });
    // Null, not 0. Zero is a real and different setting — hand pads out for
    // nothing — and the server refuses the add only on null.
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: null,
      joystick_included: 1,
      joystick_charged_slots: null,
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  test("a venue on a zero fee opens on Free, not on an empty price box", async () => {
    await mount(settings({ joystick_price: 0 }));

    expect(choice("Free").checked).toBe(true);
    expect(boxes().length).toBe(0);
    expect(save().disabled).toBe(true);
  });

  test("a venue that offers no pads opens on Not offered", async () => {
    await mount(settings({ joystick_price: null }));

    expect(choice("None").checked).toBe(true);
    expect(boxes().length).toBe(0);
    expect(save().disabled).toBe(true);
  });

  test("Charged with an empty box is not an answer, and is never sent as one", async () => {
    await mount();
    await type("");

    // Neither 0 nor null is guessed here: both are settings the operator can
    // pick by name one row up, so the form asks instead of choosing.
    expect(screen.getByText("joystickPrice.paidNeedsPrice")).toBeTruthy();
    expect(save().disabled).toBe(true);
    await act(async () => { fireEvent.click(save()); });
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("a fee survives a trip through Free and back", async () => {
    await mount();
    await type("500");
    await choose("Free");
    await choose("Paid");

    // Nothing to retype: the choice decides whether the figure is used, not
    // whether it is remembered.
    expect(box().value).toBe("500");
    await act(async () => { fireEvent.click(save()); });
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 500,
      joystick_included: 1,
      joystick_charged_slots: null,
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  test("Save stays down until something actually changes", async () => {
    await mount();

    expect(save().disabled).toBe(true);
    // "300.00" is the same fee as 300 — compared as a number, or Save would
    // light up on every render against a decimal the server sent.
    await type("300.00");
    expect(save().disabled).toBe(true);

    await type("301");
    expect(save().disabled).toBe(false);
  });

  /**
   * A minus never reaches the form's state: `PriceInput` accepts digits and one
   * dot and nothing else. Asserted here rather than assumed, because the
   * server's `min:0` is the real guard and this is the reason the operator
   * never meets it.
   */
  test("a negative fee cannot be typed, and nothing is sent", async () => {
    await mount();
    await type("-1");

    expect(box().value).toBe("300");
    expect(save().disabled).toBe(true);
    await act(async () => { fireEvent.click(save()); });
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("the server's refusal is shown, not swallowed", async () => {
    // `mockImplementationOnce` on a freshly reset mock, deliberately: a
    // persistent throwing implementation left on this mock is reported by the
    // runner as an error of its own, before and regardless of any call, and
    // fails a test whose assertion in fact passes.
    repo.update.mockReset();
    repo.update.mockImplementationOnce(async () => { throw new Error("Only the owner sets prices"); });
    await mount();
    await type("500");
    await act(async () => { fireEvent.click(save()); });

    expect(screen.getByText("Only the owner sets prices")).toBeTruthy();
  });

  // ── which pads are sold ──────────────────────────────────────────────

  test("the choice goes back with the fee, and offers exactly three answers", async () => {
    await mount();

    // Nothing chosen in the fixture, so the placeholder is there too. The
    // legacy "only the fourth is charged" answer is NOT offered to a venue
    // that never picked it: the screen now asks "3" or "3/4", and the fourth
    // pad's own price is the question underneath.
    expect(allowance().value).toBe("");
    expect([...allowance().querySelectorAll("option")].map((o) => o.value))
      .toEqual(["", "3", "3/4"]);

    await chooseSlots("3/4");
    await act(async () => { fireEvent.click(save()); });

    // The venue's figures travel together: the server validates the policy as
    // one object, and a half-sent policy is how the other half gets reset.
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 300,
      joystick_included: 1,
      joystick_charged_slots: "3,4",
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  // ── which strategies the club allows ─────────────────────────────────

  /** The club's answer rides with the rest of the policy, like every field. */
  test("the club's allowed strategies go back with the policy", async () => {
    await mount();
    await pickClubMode("both");
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      joystick_strategy_mode: "both",
    }));
  });

  /**
   * A club that never chose is shown the one strategy it already uses, not an
   * empty third state: the setting is derived from what it bills today.
   */
  test("a club that never chose opens on the strategy it already uses", async () => {
    await mount(settings({ joystick_pricing_mode: "hourly" }));

    expect(clubRadio("change_tariff").checked).toBe(true);
    expect(clubRadio("both").checked).toBe(false);
  });

  test("a fee club opens on fixed price only", async () => {
    await mount(settings({ joystick_pricing_mode: "fixed" }));

    expect(clubRadio("fixed_price").checked).toBe(true);
  });

  /** Changing only the club's answer is enough to enable Save. */
  test("changing only the allowed strategies enables Save", async () => {
    await mount();

    expect(save().disabled).toBe(true);
    await pickClubMode("both");
    expect(save().disabled).toBe(false);
  });

  /** "Both" says in words what it changes, because it changes another screen. */
  test("choosing both explains that the cashier will pick per session", async () => {
    await mount();
    await pickClubMode("both");

    expect(screen.getByText("joystickPrice.clubModeExplain.both")).toBeTruthy();
    expect(screen.queryByText("joystickPrice.clubModeExplain.single")).toBeNull();
  });

  // ── the three shapes a venue's extra pads can take ───────────────────

  /**
   * "3" and No: this venue hands out three controllers and there is no fourth.
   *
   * The distinction the whole section exists for. "The fourth is free" and
   * "there is no fourth here" used to be the same stored row, so a floor with
   * three pads per seat had a fourth entry its staff could pick and a fourth
   * line its players could be charged.
   */
  test("three and No offers one box and takes the fourth pad off the menu", async () => {
    await mount();
    await chooseSlots("3");
    await answerFourth("no");

    expect(boxes().length).toBe(1);
    expect(screen.getByText("joystickPrice.price3")).toBeTruthy();
    expect(screen.queryByText("joystickPrice.price4")).toBeNull();
    expect(screen.getByText("joystickPrice.setupExplain.only3")).toBeTruthy();

    await act(async () => { fireEvent.click(save()); });
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      joystick_charged_slots: "3",
      joystick_max_slot: 3,
      joystick_price_4: null,
    }));
  });

  /** "3" and Yes: two pads, two prices, and they are two decisions. */
  test("three and Yes offers a second box and sends the fourth pads own price", async () => {
    await mount();
    await chooseSlots("3");
    await answerFourth("yes");

    expect(boxes().length).toBe(2);
    expect(screen.getByText("joystickPrice.price3")).toBeTruthy();
    expect(screen.getByText("joystickPrice.price4")).toBeTruthy();

    await typeIn(0, "500");
    await typeIn(1, "700");
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      joystick_price: 500,
      joystick_price_4: 700,
      joystick_charged_slots: "3,4",
      joystick_max_slot: 4,
    }));
  });

  /** "3/4": one figure for an extra pad, whichever one it is. */
  test("three over four asks no question and sends one shared figure", async () => {
    await mount();
    await chooseSlots("3/4");

    // The question belongs to "3" alone: "3/4" has already answered it.
    expect(screen.queryByText("joystickPrice.useFourth")).toBeNull();
    expect(boxes().length).toBe(1);
    expect(screen.getByText("joystickPrice.priceShared")).toBeTruthy();

    await typeIn(0, "500");
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      joystick_price: 500,
      joystick_price_4: null,
      joystick_charged_slots: "3,4",
      joystick_max_slot: 4,
    }));
  });

  /** Yes with nothing typed is not an answer, and must not be guessed at. */
  test("Yes with an empty fourth box holds Save down", async () => {
    await mount();
    await chooseSlots("3");
    await answerFourth("yes");
    await typeIn(0, "500");

    expect(boxes()[1].value).toBe("");
    expect(save().disabled).toBe(true);
    expect(screen.getByText("joystickPrice.fourthNeedsPrice")).toBeTruthy();

    await typeIn(1, "700");
    expect(save().disabled).toBe(false);
  });

  /** Each stored shape opens on itself, or the owner cannot read their own rule. */
  test("a venue that prices the fourth apart opens on three and Yes", async () => {
    await mount(settings({ joystick_charged_slots: "3,4", joystick_price_4: 700, joystick_max_slot: 4 }));

    expect(allowance().value).toBe("3");
    expect(radio("yes").checked).toBe(true);
    expect(boxes().length).toBe(2);
    expect(boxes()[1].value).toBe("700");
  });

  test("a venue that hands out three pads opens on three and No", async () => {
    await mount(settings({ joystick_charged_slots: "3", joystick_max_slot: 3 }));

    expect(allowance().value).toBe("3");
    expect(radio("no").checked).toBe(true);
    expect(boxes().length).toBe(1);
  });

  test("a venue on one shared figure opens on three over four", async () => {
    await mount(settings({ joystick_charged_slots: "3,4", joystick_max_slot: 4 }));

    expect(allowance().value).toBe("3/4");
    expect(screen.queryByText("joystickPrice.useFourth")).toBeNull();
  });

  /**
   * Going back to a shared figure has to CLEAR the fourth pad's own price.
   *
   * Leaving it stored would keep the venue on two prices while the screen says
   * one, which is the state an owner cannot see and cannot undo.
   */
  test("moving from two prices to one sends the fourth price back as null", async () => {
    await mount(settings({ joystick_charged_slots: "3,4", joystick_price_4: 700, joystick_max_slot: 4 }));
    await chooseSlots("3/4");
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      joystick_price_4: null,
      joystick_charged_slots: "3,4",
      joystick_max_slot: 4,
    }));
  });

  /** Free and Not offered have no figure to give, under any shape. */
  test("the fourth box is gone under Free, and no fourth price is sent", async () => {
    await mount();
    await chooseSlots("3");
    await answerFourth("yes");
    await choose("Free");

    expect(boxes().length).toBe(0);

    await act(async () => { fireEvent.click(save()); });
    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      joystick_price: 0,
      joystick_price_4: null,
    }));
  });

  test("the first two joysticks are never an option", async () => {
    await mount();

    const values = [...allowance().querySelectorAll("option")].map((o) => o.value);
    expect(values).not.toContain("1");
    expect(values).not.toContain("2");
  });

  /**
   * A venue already on the legacy answer keeps it, and keeps it SELECTABLE.
   *
   * "Only the fourth pad is charged" is not a shape this screen offers any
   * more. Dropping it from the menu for a branch that is on it would re-price
   * that venue the first time somebody opened the page to read it, which is
   * not a thing a price screen may do.
   */
  test("a venue on the legacy answer keeps it, and loses the empty option", async () => {
    await mount(settings({ joystick_charged_slots: "4" }));

    expect(allowance().value).toBe("4");
    expect([...allowance().querySelectorAll("option")].map((o) => o.value)).toEqual(["3", "4", "3/4"]);
  });

  test("changing only the choice is enough to enable Save", async () => {
    await mount();

    expect(save().disabled).toBe(true);
    await chooseSlots("3/4");
    expect(save().disabled).toBe(false);
  });

  test("the allowance is passed through untouched, not edited here", async () => {
    // This screen names WHICH pads are sold. How many the rate covers is a
    // separate number the place card owns, and saving here must not move it.
    await mount(settings({ joystick_included: 3 }));

    await chooseSlots("3");
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 300,
      joystick_included: 3,
      joystick_charged_slots: "3",
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 3,
    }));
  });

  test("a venue can name the sold pads and still hand them out for nothing", async () => {
    // The old screen said this with "all four included". It is now two
    // answers: which pads are extra, and that an extra one costs zero. Both
    // have to survive the same save, or the VIP room loses its rule.
    await mount(settings({ joystick_price: null }));

    await chooseSlots("3/4");
    await act(async () => { fireEvent.click(screen.getByText("joystickPrice.extraFree")); });
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 0,
      joystick_included: 1,
      joystick_charged_slots: "3,4",
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  // ── how a pad is priced ───────────────────────────────────────────────

  test("the venue picks between a fee and an hourly rate, and nothing else", () => {
    return mount().then(() => {
      expect([...strategy().querySelectorAll("option")].map((o) => o.value))
        .toEqual(["fixed", "hourly"]);
      // A venue that has never chosen bills the way it always did.
      expect(strategy().value).toBe("fixed");
    });
  });

  test("the chosen model goes back with the rest of the policy", async () => {
    await mount();

    await chooseStrategy("hourly");
    await act(async () => { fireEvent.click(save()); });

    expect(repo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      money_rounding_step: 100,
      money_rounding_mode: "nearest",
      joystick_price: 300,
      joystick_included: 1,
      joystick_charged_slots: null,
      joystick_pricing_mode: "hourly",
      joystick_price_4: null,
      joystick_max_slot: 4,
    }));
  });

  test("a venue already on the hourly model opens on it", async () => {
    await mount(settings({ joystick_pricing_mode: "hourly" }));

    expect(strategy().value).toBe("hourly");
  });

  test("changing only the model is enough to enable Save", async () => {
    await mount();

    expect(save().disabled).toBe(true);
    await chooseStrategy("hourly");
    expect(save().disabled).toBe(false);
  });
});
