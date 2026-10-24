// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import PadToggle from "./PadToggle";
import type { PadChoice } from "./joystickView";

/**
 * The "+🎮" switch (2026-10-25): what it says and what a press does. It never
 * prices time — the bill is the server's — so these are about the words on the
 * button and the calls it makes.
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
  render(
    <PadToggle next={pad()} extrasOut={0} hourly={false} currentRate={1000} busy={false}
      onAdd={onAdd} onRemove={onRemove} {...props} />,
  );
  return { onAdd, onRemove };
};

describe("what +🎮 says", () => {
  test("an hourly seat shows the surcharge and the rate after it", () => {
    mount({ hourly: true, currentRate: 1000 });
    expect(screen.getByTestId("pad-caption").textContent).toContain("+500session.perHourShort → 1500session.perHourShort");
  });

  test("the rate after counts the pads already out", () => {
    // 1 000 seat + one 500/h pad out = 1 500 now; the next 500/h makes 2 000.
    mount({ hourly: true, currentRate: 1500, extrasOut: 1, next: pad({ slot: 4 }) });
    expect(screen.getByTestId("pad-caption").textContent).toContain("→ 2000session.perHourShort");
  });

  test("a fixed seat shows a one-off fee and never a rate", () => {
    mount({ hourly: false });
    const text = screen.getByTestId("pad-caption").textContent ?? "";
    expect(text).toContain("+500");
    expect(text).not.toContain("session.perHourShort");
    expect(text).not.toContain("→");
  });

  test("free, no price and already charged read as such", () => {
    mount({ next: pad({ price: 0 }) });
    expect(screen.getByTestId("pad-caption").textContent).toContain("session.padFree");
    cleanup();
    mount({ next: pad({ price: null }) });
    expect(screen.getByTestId("pad-caption").textContent).toContain("session.padNoPrice");
    expect((screen.getByTestId("pad-add") as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    mount({ next: pad({ price: 0, feeTaken: true }) });
    expect(screen.getByTestId("pad-caption").textContent).toContain("session.padFeeTaken");
  });

  test("a free seat shows no rate it would not charge", () => {
    mount({ hourly: true, currentRate: null });
    const text = screen.getByTestId("pad-caption").textContent ?? "";
    expect(text).toContain("+500session.perHourShort");
    expect(text).not.toContain("→");
  });
});

describe("inside a button is the joystick and nothing else", () => {
  test("every button holds one icon and no text, in every state", () => {
    mount({ hourly: true, extrasOut: 1, next: pad({ slot: 4 }) });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.textContent).toBe("");
      expect(b.querySelectorAll("svg")).toHaveLength(1);
      expect(b.className).toContain("pad-toggle__btn");
      // Named for a screen reader, since nothing visible is.
      expect(b.getAttribute("aria-label")).toBeTruthy();
    }
  });
});

describe("what a press does", () => {
  test("+🎮 hands over the pad that comes next", () => {
    const { onAdd, onRemove } = mount({ next: pad({ slot: 3 }) });
    fireEvent.click(screen.getByTestId("pad-add"));
    expect(onAdd).toHaveBeenCalledWith(3);
    expect(onRemove).not.toHaveBeenCalled();
  });

  test("nothing to hand out: +🎮 is disabled and calls nothing", () => {
    const { onAdd } = mount({ next: pad({ enabled: false }) });
    const add = screen.getByTestId("pad-add") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(onAdd).not.toHaveBeenCalled();
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
    expect(screen.getByTestId("pad-caption").textContent).toContain("session.padOutCount: 1");
    expect(screen.queryByTestId("pad-add")).toBeNull();
    fireEvent.click(sw);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("a venue with a fourth controller keeps +🎮 beside the lit switch", () => {
    mount({ extrasOut: 1, next: pad({ slot: 4, price: 700 }) });
    expect(screen.getByTestId("pad-remove")).toBeTruthy();
    expect(screen.getByTestId("pad-caption").textContent).toContain("700");
  });
});
