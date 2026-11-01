// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import PadToggle from "./PadToggle";
import type { PadChoice } from "./joystickView";

/**
 * The joystick switch (2026-10-25): one cell of the card's action grid, the
 * joystick icon and nothing else, and the calls a press makes. It never prices
 * anything — the bill is the server's.
 */
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => String(n) }),
}));

afterEach(() => cleanup());

const pad = (over: Partial<PadChoice> = {}): PadChoice =>
  ({ slot: 3, shared: false, price: 500, feeTaken: false, enabled: true, taken: false, ...over });

const mount = (props: Partial<Parameters<typeof PadToggle>[0]> = {}) => {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  render(<PadToggle next={pad()} extrasOut={0} busy={false} onAdd={onAdd} onRemove={onRemove} {...props} />);
  return { onAdd, onRemove };
};

describe("the joystick and nothing else", () => {
  test("every button holds one icon, no text, and is a card action", () => {
    mount({ extrasOut: 1, next: pad({ slot: 4 }) });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.textContent).toBe("");
      expect(b.querySelectorAll("svg")).toHaveLength(1);
      // The same class every other card action carries, so the same size.
      expect(b.className).toContain("session-card__btn");
      // Named for a screen reader, since nothing visible is.
      expect(b.getAttribute("aria-label")).toBeTruthy();
    }
  });

  test("no price, rate or count is printed anywhere in it", () => {
    mount({ extrasOut: 1, next: pad({ slot: 4, price: 300 }) });
    expect(screen.getByTestId("pad-toggle").textContent).toBe("");
  });
});

describe("what a press does", () => {
  test("hands over the pad that comes next", () => {
    const { onAdd, onRemove } = mount({ next: pad({ slot: 3 }) });
    fireEvent.click(screen.getByTestId("pad-add"));
    expect(onAdd).toHaveBeenCalledWith(3);
    expect(onRemove).not.toHaveBeenCalled();
  });

  test("nothing to hand out, or no price set: disabled and calls nothing", () => {
    for (const next of [pad({ enabled: false }), pad({ price: null })]) {
      const { onAdd } = mount({ next });
      const add = screen.getByTestId("pad-add") as HTMLButtonElement;
      expect(add.disabled).toBe(true);
      fireEvent.click(add);
      expect(onAdd).not.toHaveBeenCalled();
      cleanup();
    }
  });

  test("a free pad can still be handed over", () => {
    const { onAdd } = mount({ next: pad({ price: 0 }) });
    fireEvent.click(screen.getByTestId("pad-add"));
    expect(onAdd).toHaveBeenCalledWith(3);
  });

  test("while a change is in flight every button is held", () => {
    const { onAdd, onRemove } = mount({ busy: true, extrasOut: 1, next: pad({ slot: 4 }) });
    for (const b of screen.getAllByRole("button")) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(b);
    }
    expect(onAdd).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  test("a pad out lights the switch, and pressing it takes the last one back", () => {
    const { onAdd, onRemove } = mount({ extrasOut: 1, next: null });
    const sw = screen.getByTestId("pad-remove");
    expect(sw.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("pad-add")).toBeNull();
    fireEvent.click(sw);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("a venue with a fourth controller keeps an unlit button beside the lit one", () => {
    const { onAdd } = mount({ extrasOut: 1, next: pad({ slot: 4, price: 700 }) });
    expect(screen.getByTestId("pad-remove")).toBeTruthy();
    expect(screen.getByTestId("pad-add").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByTestId("pad-add"));
    expect(onAdd).toHaveBeenCalledWith(4);
  });

  test("custom names for the charge-once switch", () => {
    mount({ addLabelKey: "session.padAddOne", removeLabelKey: "session.padRemoveOne", groupLabelKey: null });
    expect(screen.getByRole("button", { name: "session.padAddOne" })).toBeTruthy();
    expect(screen.getByTestId("pad-toggle").getAttribute("aria-label")).toBeNull();
  });
});
