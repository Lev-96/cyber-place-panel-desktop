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
/** The allowance select. The form has exactly one <select>. */
const allowance = () => {
  const selects = dom.querySelectorAll("select");
  expect(selects.length).toBe(1);
  return selects[0] as HTMLSelectElement;
};
const chooseIncluded = async (n: number) => {
  await act(async () => { fireEvent.change(allowance(), { target: { value: String(n) } }); });
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

describe("JoystickPricesForm", () => {
  beforeEach(() => repo.update.mockReset().mockResolvedValue(settings()));
  afterEach(cleanup);

  test("a priced venue opens on Charged, with one box holding its fee", async () => {
    await mount();

    expect(choice("Paid").checked).toBe(true);
    expect(box().value).toBe("300");
    expect(screen.getByText("joystickPrice.extraPrice")).toBeTruthy();
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
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", 500, 1);
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
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", 0, 1);
  });

  test("Not offered withdraws the offer rather than pricing it at zero", async () => {
    await mount();
    await choose("None");

    expect(boxes().length).toBe(0);
    expect(screen.getByText("joystickPrice.noneNote")).toBeTruthy();

    await act(async () => { fireEvent.click(save()); });
    // Null, not 0. Zero is a real and different setting — hand pads out for
    // nothing — and the server refuses the add only on null.
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", null, 1);
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
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", 500, 1);
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

  // ── the allowance ────────────────────────────────────────────────────

  test("the allowance goes back with the fee, and offers every pad a seat can hold", async () => {
    await mount();

    expect(allowance().value).toBe("1");
    expect(allowance().querySelectorAll("option").length).toBe(4);

    await chooseIncluded(2);
    await act(async () => { fireEvent.click(save()); });

    // The venue's two numbers travel together, because the server validates
    // them as one policy and a half-sent policy is how the other half gets
    // reset to a default nobody chose.
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", 300, 2);
  });

  test("a backend that does not know the field is read as one included pad", async () => {
    // `joystick_included` absent, which is exactly what an older backend sends.
    await mount(settings({ joystick_included: undefined }));

    expect(allowance().value).toBe("1");

    await type("500");
    await act(async () => { fireEvent.click(save()); });

    // 1, not undefined: the panel states the rule that backend actually applies
    // rather than passing its silence along.
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", 500, 1);
  });

  test("changing only the allowance is enough to enable Save", async () => {
    await mount();

    expect(save().disabled).toBe(true);
    await chooseIncluded(3);
    expect(save().disabled).toBe(false);
  });

  test("including every pad says nothing here will be charged", async () => {
    await mount();
    expect(screen.queryByText("joystickPrice.allIncluded")).toBeNull();

    await chooseIncluded(4);

    // The fee stays, and stays saveable: a venue that sets four included today
    // and three tomorrow should not have to retype it.
    expect(screen.getByText("joystickPrice.allIncluded")).toBeTruthy();
    expect(box().value).toBe("300");
  });

  test("a venue that includes every pad can save with no price at all", async () => {
    await mount(settings({ joystick_price: null }));

    await chooseIncluded(4);
    await act(async () => { fireEvent.click(save()); });

    // Null price plus a full allowance is the VIP room: every pad is in the
    // rate, so there is no fee to enter and the add is never refused.
    expect(repo.update).toHaveBeenCalledWith(7, 100, "nearest", null, 4);
  });
});
