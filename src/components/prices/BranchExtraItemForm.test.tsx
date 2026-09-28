// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * The venue's answer for the rooms that have not given one.
 *
 * The pads have had this screen all along; a custom-platform room's extra had
 * nothing, so a venue running ten billiard tables answered the same seven
 * questions ten times. Three things are worth pinning, and every one of them
 * is silent when it breaks:
 *
 *  - the PUT carries the WHOLE policy. The endpoint validates it as one
 *    object, so a form sending only its own half would blank the rounding rule
 *    and every joystick answer beside it — from a screen opened to price a cue;
 *  - an EMPTY name withdraws the venue's answer and nulls the rest with it,
 *    because a ceiling or an allowance on a thing nobody hands out is a number
 *    about nothing;
 *  - a ZERO is not an empty box. A venue pricing cues at 0 hands them out for
 *    nothing and an allowance of 0 says "none are in the rate" — `Number("")`
 *    being 0 is exactly the confusion this keeps out of the payload.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), currency: "AMD", lang: "en" }),
}));

import BranchExtraItemForm from "./BranchExtraItemForm";

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7,
  money_rounding_step: 50,
  money_rounding_mode: "nearest",
  joystick_price: 400,
  joystick_included: 2,
  joystick_charged_slots: "3,4",
  joystick_pricing_mode: "hourly",
  joystick_price_4: 700,
  joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff",
  extra_item_name: null,
  extra_item_price: null,
  extra_item_charge_mode: null,
  extra_item_pricing_mode: null,
  extra_item_included: null,
  extra_item_max: null,
  extra_item_charged_units: null,
  ...over,
});

let dom: HTMLElement;

const mount = async (s: IBillingSettings) => {
  await act(async () => {
    const r = render(<BranchExtraItemForm branchId={7} settings={s} onSaved={() => {}} />);
    dom = r.container;
  });
};

/** By label, because four numeric boxes share one markup. */
const boxFor = (label: string): HTMLInputElement => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === label);
  return heading!.parentElement!.querySelector<HTMLInputElement>("input")!;
};
const nameBox = () => boxFor("branchExtraItem.name");
const decimals = () => [...dom.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')];
/** The room's own figure, and the one for every charged unit after the first. */
const priceBox = () => decimals()[0];
const priceNextBox = () => decimals()[1];
const includedBox = () => boxFor("place.extraItemIncluded");
const maxBox = () => boxFor("place.extraItemMax");
const unitsBox = () => boxFor("place.extraItemChargedUnits");
const saveButton = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
const body = () => repo.update.mock.calls[0][1] as Record<string, unknown>;

const type = async (el: HTMLInputElement, value: string) => {
  await act(async () => { fireEvent.change(el, { target: { value } }); });
};
const save = async () => { await act(async () => { saveButton().click(); }); };

beforeEach(() => { repo.update.mockReset().mockResolvedValue({}); });
afterEach(() => cleanup());

describe("the venue's own extra", () => {
  test("an untouched screen cannot be saved", async () => {
    await mount(settings());

    // Every branch starts unanswered, and an owner who came to READ it must
    // not be able to store a choice they never made.
    expect(saveButton().disabled).toBe(true);
  });

  test("the whole policy goes back, not just this form's half", async () => {
    await mount(settings());

    await type(nameBox(), "Кий");
    await type(priceBox(), "700");
    await save();

    // The joystick answers and the rounding rule survive a save made from
    // this screen. They are validated as one object.
    expect(body().money_rounding_step).toBe(50);
    expect(body().joystick_price).toBe(400);
    expect(body().joystick_price_4).toBe(700);
    expect(body().joystick_charged_slots).toBe("3,4");
    expect(body().joystick_max_slot).toBe(4);
  });

  test("a named and priced extra travels with every number beside it", async () => {
    await mount(settings());

    await type(nameBox(), "Кий");
    await type(priceBox(), "700");
    await type(includedBox(), "2");
    await type(maxBox(), "5");
    await type(unitsBox(), "3");
    await save();

    expect(body().extra_item_name).toBe("Кий");
    expect(body().extra_item_price).toBe(700);
    expect(body().extra_item_included).toBe(2);
    expect(body().extra_item_max).toBe(5);
    expect(body().extra_item_charged_units).toBe("3");
  });

  test("naming it without pricing it is refused, as the server refuses it", async () => {
    await mount(settings());

    await type(nameBox(), "Кий");

    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("branchExtraItem.priceRequired")).toBeTruthy();
  });

  test("clearing the name withdraws the answer and nulls the rest with it", async () => {
    await mount(settings({
      extra_item_name: "Кий", extra_item_price: "700.00", extra_item_included: 2, extra_item_max: 5,
    }));

    await type(nameBox(), "");
    await save();

    expect(body().extra_item_name).toBeNull();
    expect(body().extra_item_price).toBeNull();
    expect(body().extra_item_included).toBeNull();
    expect(body().extra_item_max).toBeNull();
  });

  test("⚠️ a zero price is a decision and travels as zero", async () => {
    await mount(settings());

    await type(nameBox(), "Кий");
    await type(priceBox(), "0");
    await save();

    expect(body().extra_item_price).toBe(0);
  });

  test("⚠️ an allowance of zero travels as zero, not as no answer", async () => {
    await mount(settings());

    await type(nameBox(), "Кий");
    await type(priceBox(), "700");
    await type(includedBox(), "0");
    await save();

    expect(body().extra_item_included).toBe(0);
  });

  test("an existing answer comes back into the boxes", async () => {
    await mount(settings({
      extra_item_name: "Фишки",
      extra_item_price: "500.00",
      extra_item_included: 1,
      extra_item_max: 9,
      extra_item_charged_units: "3,4",
    }));

    expect(nameBox().value).toBe("Фишки");
    expect(includedBox().value).toBe("1");
    expect(maxBox().value).toBe("9");
    expect(unitsBox().value).toBe("3,4");
  });

  test("the numeric boxes take digits and nothing else", async () => {
    await mount(settings());

    await type(nameBox(), "Кий");
    await type(includedBox(), "2a");
    await type(maxBox(), "3b");
    await type(unitsBox(), "3;a,4");

    expect(includedBox().value).toBe("2");
    expect(maxBox().value).toBe("3");
    expect(unitsBox().value).toBe("3,4");
  });
});

/**
 * The venue's SECOND figure — what each charged unit after the first costs.
 *
 * `joystick_price_4` one domain over: two figures for what looks like one
 * question, because they are two decisions even when the numbers agree today.
 */
describe("the units after the first", () => {
  test("a second figure travels beside the first", async () => {
    await mount(settings());

    await type(nameBox(), "\u041a\u0438\u0439");
    await type(priceBox(), "700");
    await type(priceNextBox(), "500");
    await save();

    expect(body().extra_item_price).toBe(700);
    expect(body().extra_item_price_next).toBe(500);
  });

  test("an empty box is 'priced like the first', which travels as null", async () => {
    await mount(settings());

    await type(nameBox(), "\u041a\u0438\u0439");
    await type(priceBox(), "700");
    await save();

    expect(body().extra_item_price_next).toBeNull();
  });

  test("\u26a0\ufe0f a second figure of ZERO is a decision and travels as zero", async () => {
    await mount(settings());

    await type(nameBox(), "\u041a\u0438\u0439");
    await type(priceBox(), "700");
    await type(priceNextBox(), "0");
    await save();

    expect(body().extra_item_price_next).toBe(0);
  });

  test("clearing the name withdraws it with everything else", async () => {
    await mount(settings({ extra_item_name: "\u041a\u0438\u0439", extra_item_price: "700.00", extra_item_price_next: "500.00" }));

    await type(nameBox(), "");
    await save();

    expect(body().extra_item_price_next).toBeNull();
  });
});
