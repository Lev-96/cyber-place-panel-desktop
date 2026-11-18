// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DateField, { isoToDisplay } from "./DateField";

/** The owner reads 18.11.2026, never the machine's 11/18/2026 (2026-11-18). */
describe("DateField", () => {
  afterEach(cleanup);

  test("reads day.month.year", () => {
    expect(isoToDisplay("2026-11-18")).toBe("18.11.2026");
    expect(isoToDisplay("2026-01-05")).toBe("05.01.2026");
    render(<DateField value="2026-11-18" onChange={() => {}} ariaLabel="From" testId="d" />);
    expect(screen.getByTestId("d").querySelector("button")!.textContent).toBe("18.11.2026");
  });

  test("a date picked in the calendar comes back as ISO; an empty pick is ignored", () => {
    const onChange = vi.fn();
    render(<DateField value="2026-11-18" onChange={onChange} ariaLabel="From" testId="d" />);
    const native = screen.getByTestId("d").querySelector("input")!;
    fireEvent.change(native, { target: { value: "2026-11-17" } });
    expect(onChange).toHaveBeenCalledWith("2026-11-17");
    onChange.mockClear();
    fireEvent.change(native, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("pressing the date opens the calendar", () => {
    render(<DateField value="2026-11-18" onChange={() => {}} ariaLabel="From" testId="d" />);
    const native = screen.getByTestId("d").querySelector("input")! as HTMLInputElement & { showPicker: () => void };
    native.showPicker = vi.fn();
    fireEvent.click(screen.getByTestId("d").querySelector("button")!);
    expect(native.showPicker).toHaveBeenCalledTimes(1);
  });
});
