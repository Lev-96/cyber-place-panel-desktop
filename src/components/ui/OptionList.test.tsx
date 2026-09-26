// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import OptionList from "./OptionList";

/**
 * The keyboard contract of the one-tab-stop list: ↑/↓ wrap, Home/End jump,
 * Enter chooses the highlighted option and nothing else, Escape hands focus
 * back and keeps the dialog, a click chooses and leaves the keys working.
 */

interface Item { id: number; name: string }
const items: Item[] = [{ id: 20, name: "Cola" }, { id: 21, name: "Cola can" }, { id: 22, name: "Cola 1L" }];

const mount = (over: Partial<React.ComponentProps<typeof OptionList<Item>>> = {}) => {
  const onChoose = vi.fn();
  const onEscape = vi.fn();
  render(
    <OptionList<Item>
      options={items}
      optionKey={(o) => o.id}
      renderOption={(o) => o.name}
      selectedKey={null}
      onChoose={onChoose}
      label="Which product?"
      onEscape={onEscape}
      {...over}
    />,
  );
  return { onChoose, onEscape, list: screen.getByRole("listbox", { name: "Which product?" }) };
};

const active = (list: HTMLElement) => document.getElementById(list.getAttribute("aria-activedescendant") ?? "")?.textContent;
const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(el, { key: k, ...init });

const scrolled = vi.fn();
beforeEach(() => {
  scrolled.mockReset();
  Element.prototype.scrollIntoView = function (this: Element) { scrolled(this.textContent); };
});
afterEach(() => cleanup());

describe("OptionList", () => {
  test("a listbox of options — no radio inputs — and one tab stop", () => {
    const { list } = mount();
    expect(document.querySelectorAll("input[type=radio]")).toHaveLength(0);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Cola", "Cola can", "Cola 1L"]);
    expect(list.tabIndex).toBe(0);
    expect(screen.getAllByRole("option").every((o) => o.tabIndex < 0 || !o.hasAttribute("tabindex"))).toBe(true);
    // Nothing is chosen for the operator; the highlight starts on the first.
    expect(screen.getAllByRole("option").some((o) => o.getAttribute("aria-selected") === "true")).toBe(false);
    expect(active(list)).toBe("Cola");
  });

  test("↓ and ↑ move the highlight and wrap at both ends", () => {
    const { list } = mount();
    key(list, "ArrowDown");
    expect(active(list)).toBe("Cola can");
    key(list, "ArrowDown");
    key(list, "ArrowDown");
    expect(active(list)).toBe("Cola");
    key(list, "ArrowUp");
    expect(active(list)).toBe("Cola 1L");
    key(list, "ArrowUp");
    expect(active(list)).toBe("Cola can");
  });

  test("Home and End jump to the first and the last", () => {
    const { list, onChoose } = mount();
    key(list, "End");
    expect(active(list)).toBe("Cola 1L");
    key(list, "Enter");
    expect(onChoose).toHaveBeenLastCalledWith(items[2], "keyboard");
    key(list, "Home");
    key(list, "Enter");
    expect(onChoose).toHaveBeenLastCalledWith(items[0], "keyboard");
  });

  test("Enter chooses the highlighted option, stops there, and ignores a held key", () => {
    const outer = vi.fn();
    const onChoose = vi.fn();
    render(
      <div onKeyDown={outer}>
        <OptionList<Item> options={items} optionKey={(o) => o.id} renderOption={(o) => o.name}
          selectedKey={null} onChoose={onChoose} label="L" />
      </div>,
    );
    const list = screen.getByRole("listbox");
    key(list, "ArrowDown");
    const notCancelled = fireEvent.keyDown(list, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(items[1], "keyboard");
    expect(notCancelled).toBe(false);
    // Never bubbles to a form, a button or the dialog.
    expect(outer.mock.calls.filter(([e]) => e.key === "Enter")).toHaveLength(0);
    key(list, "Enter", { repeat: true });
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  test("the highlight starts on the chosen option and aria-selected marks it", () => {
    const { list } = mount({ selectedKey: 22 });
    expect(active(list)).toBe("Cola 1L");
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("Cola 1L");
  });

  test("a click chooses, focuses the list, and the keys go on from there", () => {
    const { list, onChoose } = mount();
    const can = screen.getByText("Cola can");
    fireEvent.mouseDown(can);
    fireEvent.click(can);
    expect(onChoose).toHaveBeenCalledWith(items[1], "pointer");
    expect(document.activeElement).toBe(list);
    key(list, "ArrowDown");
    key(list, "Enter");
    expect(onChoose).toHaveBeenLastCalledWith(items[2], "keyboard");
  });

  test("Escape hands focus back and cancels its default, so the dialog stays", () => {
    const { list, onEscape } = mount();
    const notCancelled = fireEvent.keyDown(list, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(notCancelled).toBe(false);
  });

  test("without onEscape, Escape is left to the dialog", () => {
    const { list } = mount({ onEscape: undefined });
    expect(fireEvent.keyDown(list, { key: "Escape" })).toBe(true);
  });

  test("a long list scrolls the highlighted option into view", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, name: `Cola ${i}` }));
    const { list } = mount({ options: many });
    scrolled.mockReset();
    for (let i = 0; i < 15; i++) key(list, "ArrowDown");
    expect(active(list)).toBe("Cola 15");
    expect(scrolled).toHaveBeenLastCalledWith("Cola 15");
  });

  test("disabled: no tab stop, keys and clicks do nothing", () => {
    const { list, onChoose } = mount({ disabled: true });
    expect(list.tabIndex).toBe(-1);
    key(list, "ArrowDown");
    key(list, "Enter");
    fireEvent.click(screen.getByText("Cola 1L"));
    expect(onChoose).not.toHaveBeenCalled();
    expect(active(list)).toBe("Cola");
  });

  test("a shorter list from the next answer keeps the highlight inside it", () => {
    const props = { optionKey: (o: Item) => o.id, renderOption: (o: Item) => o.name, selectedKey: null, onChoose: vi.fn(), label: "L" };
    const { rerender } = render(<OptionList<Item> options={items} {...props} />);
    const list = screen.getByRole("listbox");
    key(list, "End");
    rerender(<OptionList<Item> options={items.slice(0, 2)} {...props} />);
    expect(active(list)).toBe("Cola can");
    key(list, "Enter");
    expect(props.onChoose).toHaveBeenCalledWith(items[1], "keyboard");
  });
});
