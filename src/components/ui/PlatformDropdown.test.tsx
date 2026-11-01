// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import PlatformDropdown from "./PlatformDropdown";

const items = [
  { value: "pc", label: "PC" },
  { value: "ps5", label: "PS5" },
  { value: "poker", label: "Poker" },
];

const box = () => screen.getByRole("combobox", { name: "Platform" });
const key = async (k: string) => { await act(async () => { fireEvent.keyDown(box(), { key: k }); }); };

afterEach(cleanup);

describe("PlatformDropdown", () => {
  test("shows the chosen item, or the placeholder", () => {
    const { rerender } = render(<PlatformDropdown items={items} value="ps5" onChange={() => {}} ariaLabel="Platform" />);
    expect(box().textContent).toBe("PS5");
    rerender(<PlatformDropdown items={items} value="" onChange={() => {}} ariaLabel="Platform" />);
    expect(box().textContent).toBe("-");
  });

  test("keyboard: open, move (wrapping), choose; Escape closes without choosing", async () => {
    const onChange = vi.fn();
    render(<PlatformDropdown items={items} value="pc" onChange={onChange} ariaLabel="Platform" />);

    await key("ArrowDown");
    expect(box().getAttribute("aria-expanded")).toBe("true");
    await key("ArrowUp"); // from PC wraps to the last
    await key("Enter");
    expect(onChange).toHaveBeenCalledWith("poker");
    expect(screen.queryByRole("listbox")).toBeNull();

    await key("Enter");
    await key("ArrowDown");
    await key("Escape");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("choosing the current item again sends nothing; a click outside closes", async () => {
    const onChange = vi.fn();
    render(
      <>
        <PlatformDropdown items={items} value="pc" onChange={onChange} ariaLabel="Platform" />
        <p>outside</p>
      </>,
    );
    await act(async () => { fireEvent.click(box()); });
    await act(async () => { fireEvent.click(screen.getByRole("option", { name: "PC" })); });
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(box()); });
    await act(async () => { fireEvent.mouseDown(screen.getByText("outside")); });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("disabled does not open", async () => {
    render(<PlatformDropdown items={items} value="pc" onChange={() => {}} ariaLabel="Platform" disabled />);
    await act(async () => { fireEvent.click(box()); });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
