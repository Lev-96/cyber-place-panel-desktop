// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { moveIndex, useSortableList, type SortableMessages } from "./useSortableList";
import { GAP, ROW, installSortableTestEnv, rowCentre as centre } from "./useSortableList.testkit";

/**
 * Drag and drop by Pointer Events and by keyboard (2026-11-13). Rows are laid
 * out by the test kit (jsdom has no layout and no PointerEvent).
 */
let restore: () => void = () => {};
beforeAll(() => { restore = installSortableTestEnv((el) => el.dataset.testid?.startsWith("item-") === true); });
afterAll(() => restore());
afterEach(() => cleanup());

const messages: SortableMessages = {
  pickedUp: (id, at, of) => `picked ${id} ${at}/${of}`,
  moved: (id, at, of) => `moved ${id} ${at}/${of}`,
  dropped: (id, at, of) => `dropped ${id} ${at}/${of}`,
  cancelled: (id, at) => `cancelled ${id} ${at}`,
};

/** A list that owns its order, the way MenuEditor's parent does. */
const Harness = ({ initial, onChange }: { initial: string[]; onChange: (next: string[]) => void }) => {
  const [ids, setIds] = useState(initial);
  const s = useSortableList<HTMLOListElement, HTMLLIElement, HTMLButtonElement>({
    ids,
    onMove: (from, to) => {
      const next = moveIndex(ids, from, to);
      onChange(next);
      setIds(next);
    },
    messages,
  });
  return (
    <>
      <ol data-testid="list" {...s.listProps}>
        {ids.map((id) => (
          <li key={id} data-testid={`item-${id}`} {...s.itemProps(id)}>
            <button type="button" data-testid={`grip-${id}`} {...s.handleProps(id)}>⠿</button>
            {id}
          </li>
        ))}
      </ol>
      <span data-testid="live">{s.announcement}</span>
    </>
  );
};

const order = () => screen.getAllByTestId(/^item-/).map((el) => el.textContent?.replace("⠿", ""));
const state = (id: string) => screen.getByTestId(`item-${id}`).getAttribute("data-sort-state");
const mount = () => {
  const onChange = vi.fn();
  render(<Harness initial={["A", "B", "C", "D", "E"]} onChange={onChange} />);
  return onChange;
};
const down = (id: string, y: number, init: PointerEventInit = {}) =>
  fireEvent.pointerDown(screen.getByTestId(`grip-${id}`), { clientY: y, pointerId: 1, button: 0, isPrimary: true, ...init });
const move = (id: string, y: number, pointerId = 1) => fireEvent.pointerMove(screen.getByTestId(`grip-${id}`), { clientY: y, pointerId });
const up = (id: string, y: number) => fireEvent.pointerUp(screen.getByTestId(`grip-${id}`), { clientY: y, pointerId: 1 });
const key = (id: string, k: string) => fireEvent.keyDown(screen.getByTestId(`grip-${id}`), { key: k });

describe("moveIndex", () => {
  const L = ["A", "B", "C", "D", "E"] as const;
  test("moves an item to the index it is dropped at, both ways", () => {
    expect(moveIndex(L, 1, 3).join("")).toBe("ACDBE");
    expect(moveIndex(L, 3, 1).join("")).toBe("ADBCE");
    expect(moveIndex(L, 0, 4).join("")).toBe("BCDEA");
    expect(moveIndex(L, 4, 0).join("")).toBe("EABCD");
    expect(moveIndex(L, 2, 3).join("")).toBe("ABDCE");
  });

  test("clamps the target to the list", () => {
    expect(moveIndex(L, 1, 99).join("")).toBe("ACDEB");
    expect(moveIndex(L, 3, -5).join("")).toBe("DABCE");
  });

  test("the same index, or a from outside the list, changes nothing and never mutates", () => {
    expect(moveIndex(L, 2, 2).join("")).toBe("ABCDE");
    expect(moveIndex(L, -1, 2).join("")).toBe("ABCDE");
    expect(moveIndex(L, 5, 0).join("")).toBe("ABCDE");
    expect(moveIndex(L, 1.5, 0).join("")).toBe("ABCDE");
    const src = ["A", "B", "C"];
    moveIndex(src, 0, 2);
    expect(src).toEqual(["A", "B", "C"]);
  });
});

describe("dragging with a pointer", () => {
  test("down on the grip, over another row, up: the row lands in that slot, onChange once", () => {
    const onChange = mount();
    down("B", centre(1));
    expect(state("B")).toBe("lifted");
    expect(screen.getByTestId("list").getAttribute("data-sorting")).toBe("pointer");

    move("B", centre(3) + 1); // past D's middle
    expect(state("C")).toBe("shift-up");
    expect(state("D")).toBe("shift-up");
    expect(state("E")).toBeNull();
    // The others slide by one row plus the gap; the slot is where D was.
    const list = screen.getByTestId("list");
    expect(list.style.getPropertyValue("--sort-shift")).toBe(`${ROW + GAP}px`);
    expect(list.style.getPropertyValue("--sort-slot-y")).toBe(`${3 * (ROW + GAP)}px`);
    // The lifted row follows the pointer by translate only.
    expect(screen.getByTestId("item-B").style.translate).toBe(`0 ${2 * (ROW + GAP) + 1}px`);

    up("B", centre(3) + 1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["A", "C", "D", "B", "E"]);
    expect(order()).toEqual(["A", "C", "D", "B", "E"]);
    expect(screen.getByTestId("list").getAttribute("data-sorting")).toBeNull();
    expect(screen.getAllByTestId(/^item-/).every((el) => !el.hasAttribute("data-sort-state"))).toBe(true);
    expect(screen.getByTestId("live").textContent).toBe("dropped B 4/5");
  });

  test("dragging up opens the slot above and the rows in between slide down", () => {
    const onChange = mount();
    down("D", centre(3));
    move("D", centre(0) - 1);
    expect(state("A")).toBe("shift-down");
    expect(state("C")).toBe("shift-down");
    up("D", centre(0) - 1);
    expect(onChange).toHaveBeenCalledWith(["D", "A", "B", "C", "E"]);
  });

  test("a drag past the list's end stops at the last slot", () => {
    const onChange = mount();
    down("A", centre(0));
    move("A", 5000);
    expect(screen.getByTestId("item-A").style.translate).toBe(`0 ${4 * (ROW + GAP)}px`);
    up("A", 5000);
    expect(onChange).toHaveBeenCalledWith(["B", "C", "D", "E", "A"]);
  });

  test("a press without a move, or a move back to the start, changes nothing", () => {
    const onChange = mount();
    down("C", centre(2));
    up("C", centre(2));
    down("C", centre(2));
    move("C", centre(4));
    move("C", centre(2) + 3);
    up("C", centre(2) + 3);
    expect(onChange).not.toHaveBeenCalled();
    expect(order()).toEqual(["A", "B", "C", "D", "E"]);
  });

  test("Escape mid-drag puts everything back, with no onChange", () => {
    const onChange = mount();
    down("B", centre(1));
    move("B", centre(4));
    expect(state("E")).toBe("shift-up");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(order()).toEqual(["A", "B", "C", "D", "E"]);
    expect(screen.getAllByTestId(/^item-/).every((el) => !el.hasAttribute("data-sort-state"))).toBe(true);
    // The others slide back; a later up is not a drop.
    expect(screen.getByTestId("list").hasAttribute("data-sort-returning")).toBe(true);
    up("B", centre(4));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("live").textContent).toBe("cancelled B 2");
  });

  test("pointercancel (the system took the touch) puts everything back, with no onChange", () => {
    const onChange = mount();
    down("B", centre(1), { pointerType: "touch" });
    move("B", centre(3) + 1);
    fireEvent.pointerCancel(screen.getByTestId("grip-B"), { pointerId: 1 });
    up("B", centre(3) + 1);
    expect(onChange).not.toHaveBeenCalled();
    expect(order()).toEqual(["A", "B", "C", "D", "E"]);
    expect(state("B")).toBeNull();
  });

  test("losing pointer capture mid-drag cancels it", () => {
    const onChange = mount();
    down("B", centre(1));
    move("B", centre(3) + 1);
    fireEvent(screen.getByTestId("grip-B"), new window.PointerEvent("lostpointercapture", { bubbles: true, pointerId: 1 }));
    expect(state("B")).toBeNull();
    up("B", centre(3) + 1);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a right button, a second finger, or another pointer does not drag", () => {
    const onChange = mount();
    down("B", centre(1), { button: 2 });
    expect(state("B")).toBeNull();
    down("B", centre(1), { isPrimary: false });
    expect(state("B")).toBeNull();
    down("B", centre(1));
    move("B", centre(4), 7); // another pointer
    expect(state("E")).toBeNull();
    up("B", centre(1));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("the list changing under a drag abandons the drag instead of misplacing", () => {
    const onMove = vi.fn();
    const Controlled = ({ ids }: { ids: string[] }) => {
      const s = useSortableList({ ids, onMove, messages });
      return (
        <ol data-testid="list" {...s.listProps}>
          {ids.map((id) => (
            <li key={id} data-testid={`item-${id}`} {...s.itemProps(id)}>
              <button type="button" data-testid={`grip-${id}`} {...s.handleProps(id)}>⠿</button>
            </li>
          ))}
        </ol>
      );
    };
    const { rerender } = render(<Controlled ids={["A", "B", "C"]} />);
    down("A", centre(0));
    move("A", centre(2) + 1);
    expect(state("A")).toBe("lifted");
    rerender(<Controlled ids={["C", "A", "B"]} />);
    expect(state("A")).toBeNull();
    up("A", centre(2) + 1);
    expect(onMove).not.toHaveBeenCalled();
  });

  test("unmounting mid-drag leaves no listener behind", () => {
    const onChange = mount();
    down("A", centre(0));
    cleanup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("moving with the keyboard", () => {
  test("Space picks up, arrows move, Enter drops; each step is announced; focus stays on the grip", () => {
    const onChange = mount();
    const grip = screen.getByTestId("grip-B");
    grip.focus();
    key("B", " ");
    expect(grip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("live").textContent).toBe("picked B 2/5");
    key("B", "ArrowDown");
    key("B", "ArrowDown");
    expect(screen.getByTestId("live").textContent).toBe("moved B 4/5");
    expect(state("C")).toBe("shift-up");
    expect(state("D")).toBe("shift-up");
    expect(onChange).not.toHaveBeenCalled();
    key("B", "Enter");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["A", "C", "D", "B", "E"]);
    expect(screen.getByTestId("live").textContent).toBe("dropped B 4/5");
    expect(document.activeElement).toBe(screen.getByTestId("grip-B"));
    expect(screen.getByTestId("grip-B").getAttribute("aria-pressed")).toBe("false");
  });

  test("arrows stop at the ends; Home and End jump there", () => {
    const onChange = mount();
    key("C", "Enter");
    key("C", "ArrowUp");
    key("C", "ArrowUp");
    key("C", "ArrowUp");
    expect(screen.getByTestId("live").textContent).toBe("moved C 1/5");
    key("C", "End");
    expect(screen.getByTestId("live").textContent).toBe("moved C 5/5");
    key("C", "Home");
    key("C", " ");
    expect(onChange).toHaveBeenCalledWith(["C", "A", "B", "D", "E"]);
  });

  test("Escape after moving puts it back, with no onChange", () => {
    const onChange = mount();
    key("B", " ");
    key("B", "ArrowDown");
    key("B", "Escape");
    expect(onChange).not.toHaveBeenCalled();
    expect(order()).toEqual(["A", "B", "C", "D", "E"]);
    expect(screen.getByTestId("live").textContent).toBe("cancelled B 2");
    // Arrows without a pick-up do nothing.
    key("B", "ArrowDown");
    expect(state("B")).toBeNull();
  });

  test("leaving the grip (Tab, a click elsewhere) cancels", () => {
    const onChange = mount();
    const grip = screen.getByTestId("grip-B");
    grip.focus();
    key("B", " ");
    key("B", "ArrowDown");
    act(() => { grip.blur(); });
    expect(state("B")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a drop without a move changes nothing", () => {
    const onChange = mount();
    key("D", " ");
    key("D", " ");
    expect(onChange).not.toHaveBeenCalled();
  });
});
