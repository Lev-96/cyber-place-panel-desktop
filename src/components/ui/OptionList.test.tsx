// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import OptionList, { optionId, stepActive } from "./OptionList";

/**
 * The options half of a combobox whose field keeps the focus: it shows the
 * highlight it is given, never takes the focus, and a click chooses through
 * the one `onChoose`. The keys are the field's — `stepActive` is theirs.
 */

interface Item { id: number; name: string }
const items: Item[] = [{ id: 20, name: "Cola" }, { id: 21, name: "Cola can" }, { id: 22, name: "Cola 1L" }];

const mount = (over: Partial<React.ComponentProps<typeof OptionList<Item>>> = {}) => {
  const onChoose = vi.fn();
  const onActivate = vi.fn();
  const utils = render(
    <OptionList<Item>
      id="pick"
      options={items}
      optionKey={(o) => o.id}
      renderOption={(o) => o.name}
      activeIndex={0}
      onActivate={onActivate}
      onChoose={onChoose}
      label="Which product?"
      {...over}
    />,
  );
  return { onChoose, onActivate, ...utils };
};

const scrolled = vi.fn();
beforeEach(() => {
  scrolled.mockReset();
  Element.prototype.scrollIntoView = function (this: Element) { scrolled(this.textContent); };
});
afterEach(() => cleanup());

describe("stepActive", () => {
  test("↓ and ↑ move one and wrap at both ends", () => {
    expect(stepActive("ArrowDown", 0, 3)).toBe(1);
    expect(stepActive("ArrowDown", 2, 3)).toBe(0);
    expect(stepActive("ArrowUp", 1, 3)).toBe(0);
    expect(stepActive("ArrowUp", 0, 3)).toBe(2);
  });

  test("any other key, or an empty list, is not the list's", () => {
    for (const key of ["Enter", "Escape", "Home", "End", "a", "Tab"]) expect(stepActive(key, 1, 3)).toBeNull();
    expect(stepActive("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("OptionList", () => {
  test("a listbox of options with stable ids — no radios, nothing focusable", () => {
    mount();
    expect(document.querySelectorAll("input[type=radio]")).toHaveLength(0);
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["Cola", "Cola can", "Cola 1L"]);
    expect(opts.map((o) => o.id)).toEqual([optionId("pick", 0), optionId("pick", 1), optionId("pick", 2)]);
    expect(screen.getByRole("listbox", { name: "Which product?" }).id).toBe("pick");
    expect(document.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  test("shows the highlight it is given and marks only that option", () => {
    mount({ activeIndex: 1 });
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.classList.contains("is-active"))).toEqual([false, true, false]);
    expect(opts.map((o) => o.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  test("a click chooses that option, and only calls onChoose", () => {
    const { onChoose } = mount();
    fireEvent.click(screen.getByText("Cola 1L"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(items[2]);
  });

  test("a press on an option never takes the focus from the field", () => {
    mount();
    expect(fireEvent.mouseDown(screen.getByText("Cola can"))).toBe(false);
  });

  test("hovering moves the highlight", () => {
    const { onActivate } = mount();
    fireEvent.mouseEnter(screen.getByText("Cola can"));
    expect(onActivate).toHaveBeenCalledWith(1);
  });

  test("a long list scrolls the highlighted option into view", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, name: `Cola ${i}` }));
    const { rerender, onChoose, onActivate } = mount({ options: many });
    scrolled.mockReset();
    rerender(
      <OptionList<Item> id="pick" options={many} optionKey={(o) => o.id} renderOption={(o) => o.name}
        activeIndex={15} onActivate={onActivate} onChoose={onChoose} label="L" />,
    );
    expect(scrolled).toHaveBeenLastCalledWith("Cola 15");
  });
});
