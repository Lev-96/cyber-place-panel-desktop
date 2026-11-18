// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DateField, { isoToDisplay } from "./DateField";

/**
 * The owner reads 18.11.2026, never the machine's 11/18/2026 (2026-11-18); the
 * real date input lies over the text, so a phone's tap opens its own calendar.
 */
describe("DateField", () => {
  afterEach(cleanup);
  const parts = () => {
    const root = screen.getByTestId("d");
    return { text: root.querySelector(".date-field__text") as HTMLElement, input: root.querySelector("input") as HTMLInputElement & { showPicker: () => void } };
  };

  test("reads day.month.year", () => {
    expect(isoToDisplay("2026-11-18")).toBe("18.11.2026");
    expect(isoToDisplay("2026-01-05")).toBe("05.01.2026");
    render(<DateField value="2026-11-18" onChange={() => {}} ariaLabel="From" testId="d" />);
    expect(parts().text.textContent).toBe("18.11.2026");
  });

  test("the real input is what a tap reaches: on top, not hidden from touch or from a screen reader", () => {
    render(<DateField value="2026-11-18" onChange={() => {}} ariaLabel="From" testId="d" />);
    const { input } = parts();
    expect(input.type).toBe("date");
    expect(input.getAttribute("aria-hidden")).toBeNull();
    expect(input.tabIndex).not.toBe(-1);
    expect(input.getAttribute("aria-label")).toBe("From: 18.11.2026");
    expect(input.className).toBe("date-field__native");
  });

  test("a date picked comes back as ISO; an empty pick is ignored", () => {
    const onChange = vi.fn();
    render(<DateField value="2026-11-18" onChange={onChange} ariaLabel="From" testId="d" />);
    fireEvent.change(parts().input, { target: { value: "2026-11-17" } });
    expect(onChange).toHaveBeenCalledWith("2026-11-17");
    onChange.mockClear();
    fireEvent.change(parts().input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a click asks for the calendar too (a computer), and a refusal is harmless (a phone opens it itself)", () => {
    render(<DateField value="2026-11-18" onChange={() => {}} ariaLabel="From" testId="d" />);
    const { input } = parts();
    input.showPicker = vi.fn();
    fireEvent.click(input);
    expect(input.showPicker).toHaveBeenCalledTimes(1);
    input.showPicker = vi.fn(() => { throw new Error("NotSupportedError"); });
    expect(() => fireEvent.click(input)).not.toThrow();
  });
});
