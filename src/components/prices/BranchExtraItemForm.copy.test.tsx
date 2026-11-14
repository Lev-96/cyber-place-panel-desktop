// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IBillingSettings } from "@/api/joystickPrices";
import { t as translate } from "@/i18n/translations";

/**
 * B5 (audit 2026-11-13): Prices → «Доп. предмет комнаты» showed a raw «{0}»
 * in the "how it is charged" select: the options went through `t()` without
 * `fmt()`. The thing's name goes in, as the room's own form already does, and
 * a venue that has not named it yet reads a generic word instead of a gap.
 * Real dictionary, every language.
 */

const lang = vi.hoisted(() => ({ current: "ru" as "en" | "ru" | "am" }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({ billingSettingsRepository: { update: vi.fn() } }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => translate(k, lang.current), money: String, currency: "AMD", lang: lang.current }),
}));

import BranchExtraItemForm from "./BranchExtraItemForm";

const settings = (name: string | null): IBillingSettings => ({
  branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 0, joystick_included: 0,
  joystick_charged_slots: "", joystick_pricing_mode: "fixed", joystick_price_4: null, joystick_max_slot: 4,
  joystick_strategy_mode: "fixed_price", extra_item_name: name, extra_item_price: name ? 500 : null,
  extra_item_charge_mode: null, extra_item_pricing_mode: null, extra_item_included: null, extra_item_max: null,
  extra_item_charged_units: null,
} as IBillingSettings);

const options = (dom: HTMLElement) => [...dom.querySelectorAll("option")].map((o) => o.textContent ?? "");

afterEach(cleanup);

describe("BranchExtraItemForm copy", () => {
  for (const l of ["en", "ru", "am"] as const) {
    test(`${l}: no raw placeholder in any option, the name goes in`, () => {
      lang.current = l;
      const { container } = render(<BranchExtraItemForm branchId={7} settings={settings("Фишки")} onSaved={() => {}} />);
      const texts = options(container);
      expect(texts.join(" | ")).not.toMatch(/\{\d\}/);
      expect(texts.filter((x) => x.includes("Фишки"))).toHaveLength(2);
    });

    test(`${l}: with no name yet, a generic word, never an empty gap`, () => {
      lang.current = l;
      const { container } = render(<BranchExtraItemForm branchId={7} settings={settings(null)} onSaved={() => {}} />);
      const texts = options(container);
      expect(texts.join(" | ")).not.toMatch(/\{\d\}|\(\s|\s\)|\s{2}/);
      const generic = translate("branchExtraItem.itemFallback", l);
      expect(texts.filter((x) => x.includes(generic))).toHaveLength(2);
    });
  }

  test("the name typed follows into the options", async () => {
    lang.current = "en";
    const { container } = render(<BranchExtraItemForm branchId={7} settings={settings(null)} onSaved={() => {}} />);
    const name = [...container.querySelectorAll("span.label")]
      .find((el) => el.textContent === translate("branchExtraItem.name", "en"))!
      .parentElement!.querySelector("input")!;
    await act(async () => { fireEvent.change(name, { target: { value: "Cue" } }); });
    expect(options(container).filter((x) => x.includes("Cue"))).toHaveLength(2);
  });

  test("the selects are not pinned to 180px", () => {
    lang.current = "ru";
    const { container } = render(<BranchExtraItemForm branchId={7} settings={settings("Фишки")} onSaved={() => {}} />);
    for (const s of container.querySelectorAll("select")) expect((s as HTMLSelectElement).style.width).toBe("");
  });
});
