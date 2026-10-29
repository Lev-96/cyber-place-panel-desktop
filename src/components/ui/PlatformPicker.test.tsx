// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useState } from "react";

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import PlatformPicker, { type PlatformOption } from "./PlatformPicker";

afterEach(cleanup);

const Harness = ({ start, customOptions, onChange }: {
  start: string; customOptions?: PlatformOption[]; onChange?: (p: string) => void;
}) => {
  const [value, setValue] = useState(start);
  return <PlatformPicker value={value} onChange={(p) => { setValue(p); onChange?.(p); }} customOptions={customOptions} />;
};
const buttons = () => screen.getAllByRole("button").map((b) => b.textContent);
const slugBox = () => screen.queryByPlaceholderText("platform.customPlaceholder");

describe("PlatformPicker", () => {
  test("without customOptions: the known row + Other, a custom value opens the slug box", () => {
    render(<Harness start="billiards" />);
    expect(buttons()).toEqual(["PC", "PS4", "PS5", "platform.other"]);
    expect((slugBox() as HTMLInputElement).value).toBe("billiards");
  });

  test("customOptions are buttons between PS5 and Other; picking one sets its slug", async () => {
    const onChange = vi.fn();
    render(<Harness start="pc" onChange={onChange} customOptions={[{ slug: "billiards", label: "Pool table" }, { slug: "ps5", label: "dup" }]} />);
    expect(buttons()).toEqual(["PC", "PS4", "PS5", "Pool table", "platform.other"]);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Pool table" })); });
    expect(onChange).toHaveBeenLastCalledWith("billiards");
    expect(screen.getByRole("button", { name: "Pool table" }).className).not.toContain("secondary");
    expect(slugBox()).toBeNull();
  });

  test("a value that is an offered custom platform starts on its button, not on Other", () => {
    render(<Harness start="billiards" customOptions={[{ slug: "billiards", label: "Pool table" }]} />);
    expect(screen.getByRole("button", { name: "Pool table" }).getAttribute("aria-pressed")).toBe("true");
    expect(slugBox()).toBeNull();
  });
});

/**
 * The adaptive layout. jsdom has no layout and no ResizeObserver, so both are
 * faked: the container's width and the measuring row's natural width are
 * stubbed by class, and the observer's callback is fired by hand — exactly
 * what Chromium does when the dialog or a label changes size.
 */
describe("PlatformPicker: one row when it fits, a select when it does not", () => {
  class FakeRO {
    static all: FakeRO[] = [];
    constructor(private cb: ResizeObserverCallback) { FakeRO.all.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
    fire() { this.cb([], this as unknown as ResizeObserver); }
  }
  const size = { container: 600, row: 400 };
  // Stubbed on HTMLElement.prototype and put back exactly as found (jsdom keeps
  // these on Element.prototype, so usually that means deleting the stub).
  const own = {
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
    scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth"),
  };
  const restore = (prop: keyof typeof own) => {
    const d = own[prop];
    if (d) Object.defineProperty(HTMLElement.prototype, prop, d);
    else delete (HTMLElement.prototype as Partial<HTMLElement>)[prop];
  };
  const stubWidth = (prop: "clientWidth" | "scrollWidth", get: (el: HTMLElement) => number) =>
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get() { return get(this as HTMLElement); } });
  const resize = async (container: number) => {
    size.container = container;
    await act(async () => { FakeRO.all.forEach((r) => r.fire()); });
  };
  // Narrow mode: the icon dropdown (a native select cannot draw the icons).
  const select = () => document.querySelector<HTMLButtonElement>(".platform-picker__select button[role=combobox]");
  const openList = async () => { await act(async () => { fireEvent.click(select()!); }); };
  const listed = () => screen.getAllByRole("option").map((o) => [o.getAttribute("data-value"), o.textContent]);
  const chosen = () => screen.getAllByRole("option").find((o) => o.getAttribute("aria-selected") === "true")?.getAttribute("data-value");
  const choose = async (value: string) => {
    await openList();
    const option = screen.getAllByRole("option").find((o) => o.getAttribute("data-value") === value)!;
    await act(async () => { fireEvent.click(option); });
  };
  const customs = [{ slug: "billiards", label: "Pool table" }, { slug: "poker", label: "Poker" }];

  beforeEach(() => {
    FakeRO.all = [];
    size.container = 600;
    size.row = 400;
    vi.stubGlobal("ResizeObserver", FakeRO);
    stubWidth("clientWidth", (el) => (el.classList.contains("platform-picker__fit") ? size.container : 0));
    stubWidth("scrollWidth", (el) => (el.classList.contains("platform-picker__row--measure") ? size.row : 0));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    restore("clientWidth");
    restore("scrollWidth");
  });

  test("too narrow: a dropdown with the same ordered list, icons, and an Other… entry", async () => {
    render(<Harness start="poker" customOptions={customs} />);
    expect(select()).toBeNull();

    await resize(300);
    const box = select()!;
    expect(box.className).toContain("input");
    expect(box.textContent).toBe("Poker");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    await openList();
    expect(listed()).toEqual([
      ["pc", "PC"], ["ps4", "PS4"], ["ps5", "PS5"], ["billiards", "Pool table"], ["poker", "Poker"], ["-other", "platform.otherOption"],
    ]);
    expect(chosen()).toBe("poker");
    // Every platform carries its icon; Other carries none.
    const kinds = screen.getAllByRole("option").map((o) => o.querySelector(".platform-icon")?.getAttribute("data-kind") ?? null);
    expect(kinds).toEqual(["pc", "ps", "ps", "billiards", "poker", null]);
  });

  test("the selection survives fits → compact → fits, and the select changes it", async () => {
    const onChange = vi.fn();
    render(<Harness start="pc" customOptions={customs} onChange={onChange} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Pool table" })); });

    await resize(300);
    expect(select()!.textContent).toBe("Pool table");
    expect(onChange).toHaveBeenCalledTimes(1);

    await choose("ps4");
    expect(onChange).toHaveBeenLastCalledWith("ps4");

    await resize(800);
    expect(screen.getByRole("button", { name: "PS4" }).getAttribute("aria-pressed")).toBe("true");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test("Other in the select opens the slug box, and stays Other across the switch", async () => {
    const onChange = vi.fn();
    render(<Harness start="pc" onChange={onChange} />);
    await resize(300);
    await choose("-other");
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(select()!.textContent).toBe("platform.otherOption");
    expect(slugBox()).not.toBeNull();

    await resize(800);
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("true");
    expect(slugBox()).not.toBeNull();
  });

  test("a saved slug the branch no longer offers keeps its own option, never a blank", async () => {
    render(<Harness start="old-room" customOptions={customs} />);
    // Buttons: on Other, with the slug in the box.
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("true");
    expect((slugBox() as HTMLInputElement).value).toBe("old-room");

    await resize(300);
    expect(select()!.textContent).toBe("Old Room");
    await openList();
    expect(chosen()).toBe("old-room");
  });
});

describe("PlatformPicker: data that arrives late, keyboard", () => {
  test("custom options loading after mount put the saved value on its own button", async () => {
    const { rerender } = render(<PlatformPicker value="billiards" onChange={() => {}} customOptions={[]} />);
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("true");

    rerender(<PlatformPicker value="billiards" onChange={() => {}} customOptions={[{ slug: "billiards", label: "Pool table" }]} />);
    expect(screen.getByRole("button", { name: "Pool table" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("false");
    expect(slugBox()).toBeNull();
  });

  test("every visible choice is a native button in the tab order with aria-pressed; the measuring copy is not", () => {
    render(<Harness start="ps5" customOptions={[{ slug: "billiards", label: "Pool table" }]} />);
    const visible = screen.getAllByRole("button");
    expect(visible.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false", "false"]);
    for (const b of visible) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("type")).toBe("button");
      expect(b.tabIndex).toBe(0);
    }
    const measured = document.querySelectorAll(".platform-picker__row--measure button");
    expect(measured).toHaveLength(5);
    measured.forEach((b) => expect((b as HTMLButtonElement).tabIndex).toBe(-1));
    expect(document.querySelector(".platform-picker__measure-clip")!.getAttribute("aria-hidden")).toBe("true");
  });

  /**
   * Under Other, a value the list offers is shown on its own button only when
   * the PARENT names the platform (PlaceForm, `hideOtherInput`). The picker's
   * own slug box keeps Other while typed, so "pc-club" passing through "pc"
   * never hides the box mid-word (GameForm, unchanged).
   */
  test("a parent-named value that is offered leaves Other; the picker's own box does not", async () => {
    const Named = () => {
      const [value, setValue] = useState("pc");
      return (
        <>
          <PlatformPicker value={value} onChange={setValue} hideOtherInput />
          <button type="button" onClick={() => setValue("ps4")}>name-it</button>
        </>
      );
    };
    render(<Named />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "platform.other" })); });
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("true");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "name-it" })); });
    expect(screen.getByRole("button", { name: "PS4" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("false");
    cleanup();

    render(<Harness start="pc" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "platform.other" })); });
    await act(async () => { fireEvent.change(slugBox()!, { target: { value: "pc" } }); });
    expect(screen.getByRole("button", { name: "platform.other" }).getAttribute("aria-pressed")).toBe("true");
    expect((slugBox() as HTMLInputElement).value).toBe("pc");
  });
});
