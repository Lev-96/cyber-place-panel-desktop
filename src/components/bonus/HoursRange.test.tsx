// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

import HoursRange from "./HoursRange";

afterEach(cleanup);

describe("HoursRange — the bonus hours on Start's clock field", () => {
  test("shows the saved hours in the two clock fields", () => {
    render(<HoursRange from="13:00" to="18:30" onChange={vi.fn()} />);
    const boxes = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(boxes.map((b) => b.value)).toEqual(["13", "00", "18", "30"]);
  });

  test("«1500» typed in the start → 15:00; the end is passed along as it was", async () => {
    const onChange = vi.fn();
    render(<HoursRange from="13:00" to="18:00" onChange={onChange} />);
    const [fromHours] = screen.getAllByRole("textbox");
    await act(async () => { fireEvent.change(fromHours, { target: { value: "1500" } }); });
    expect(onChange).toHaveBeenLastCalledWith("15:00", "18:00");
  });

  test("an empty field is no time: \"\" goes up, never a guess", async () => {
    const onChange = vi.fn();
    render(<HoursRange from="13:00" to="18:00" onChange={onChange} />);
    const boxes = screen.getAllByRole("textbox");
    await act(async () => { fireEvent.change(boxes[2], { target: { value: "" } }); fireEvent.change(boxes[3], { target: { value: "" } }); });
    expect(onChange).toHaveBeenLastCalledWith("13:00", "");
  });
});
