// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * The venue's joystick fee — the figure every room inherits.
 *
 * The screen that set it went when the joystick questions moved onto the
 * room's own form, and the answer a room inherits became one nobody could
 * set: a branch opened since had no way to have one, and "as the branch does"
 * on a place meant "free, apparently".
 *
 * Two things are worth pinning here, and both are silent when they break:
 *
 *  - the PUT carries the WHOLE policy. The endpoint validates it as one
 *    object, so a form sending only its own half would blank the rounding rule
 *    and the venue's strategy — from a screen opened to price a controller;
 *  - naming pads without naming their price is refused, exactly as the server
 *    refuses it on a room. Otherwise the pads are named here and priced
 *    somewhere else.
 */

const repo = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), currency: "AMD", lang: "en" }),
}));

import BranchJoystickForm from "./BranchJoystickForm";

const settings = (over: Partial<IBillingSettings> = {}): IBillingSettings => ({
  branch_id: 7,
  money_rounding_step: 50,
  money_rounding_mode: "nearest",
  joystick_price: null,
  joystick_included: 2,
  joystick_charged_slots: null,
  joystick_pricing_mode: "hourly",
  joystick_price_4: 700,
  joystick_max_slot: 4,
  joystick_strategy_mode: "change_tariff",
  ...over,
});

let dom: HTMLElement;

const mount = async (s: IBillingSettings) => {
  await act(async () => {
    const r = render(<BranchJoystickForm branchId={7} settings={s} onSaved={() => {}} />);
    dom = r.container;
  });
};

const scope = () => dom.querySelector<HTMLSelectElement>("select")!;
const price = () => dom.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
const saveButton = () => screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;

const choose = async (v: string) => {
  await act(async () => { fireEvent.change(scope(), { target: { value: v } }); });
};
const type = async (v: string) => {
  await act(async () => { fireEvent.change(price(), { target: { value: v } }); });
};
const save = async () => {
  await act(async () => { fireEvent.click(saveButton()); });
};

describe("the branch's joystick fee", () => {
  beforeEach(() => {
    repo.update.mockReset().mockResolvedValue(settings());
  });
  afterEach(cleanup);

  test("an unanswered venue opens on 'not set', with Save down", async () => {
    await mount(settings());

    expect(scope().value).toBe("");
    expect(price().value).toBe("");
    // An owner who came to read the page must not be able to save a choice
    // they never made.
    expect(saveButton().disabled).toBe(true);
  });

  test("the menu offers the third, the fourth and the pair", async () => {
    await mount(settings());

    expect([...scope().querySelectorAll("option")].map((o) => o.value))
      .toEqual(["", "3", "4", "3,4"]);
  });

  test("a stored answer comes back", async () => {
    await mount(settings({ joystick_charged_slots: "3", joystick_price: 500 }));

    expect(scope().value).toBe("3");
    expect(price().value).toBe("500");
  });

  test("naming pads without a price holds Save down and says why", async () => {
    await mount(settings());
    await choose("3,4");

    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("branchJoystick.priceRequired")).toBeTruthy();
  });

  test("the venue's answer travels as the slots and the figure", async () => {
    await mount(settings());
    await choose("3,4");
    await type("500");
    await save();

    const [id, policy] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
    expect(id).toBe(7);
    expect(policy.joystick_charged_slots).toBe("3,4");
    expect(policy.joystick_price).toBe(500);
  });

  /** Zero is a price: a venue may hand its extra pads out for nothing. */
  test("zero is a price and not an empty box", async () => {
    await mount(settings());
    await choose("3");
    await type("0");
    await save();

    const [, policy] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
    expect(policy.joystick_price).toBe(0);
  });

  /**
   * The half that breaks silently: everything this form did not ask about goes
   * back exactly as it came.
   */
  test("the rest of the policy is carried past untouched", async () => {
    await mount(settings());
    await choose("3");
    await type("500");
    await save();

    const [, policy] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
    expect(policy.money_rounding_step).toBe(50);
    expect(policy.money_rounding_mode).toBe("nearest");
    expect(policy.joystick_included).toBe(2);
    expect(policy.joystick_pricing_mode).toBe("hourly");
    expect(policy.joystick_price_4).toBe(700);
    expect(policy.joystick_max_slot).toBe(4);
    expect(policy.joystick_strategy_mode).toBe("change_tariff");
  });

  /** A venue may go back to having no answer at all. */
  test("clearing the answer sends null rather than a shape", async () => {
    await mount(settings({ joystick_charged_slots: "3", joystick_price: 500 }));
    await choose("");
    await type("");
    await save();

    const [, policy] = repo.update.mock.calls[0] as [number, Record<string, unknown>];
    expect(policy.joystick_charged_slots).toBeNull();
    expect(policy.joystick_price).toBeNull();
  });
});
