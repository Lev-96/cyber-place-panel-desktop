// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SuggestInput from "./SuggestInput";

const OPTIONS = ["levonbakunts@gmail.com", "manager@cyberplace.pro", "owner@cyberplace.pro"];

const Harness = ({
  onSubmit,
  onRemoveOption,
}: {
  onSubmit?: () => void;
  onRemoveOption?: (v: string) => void;
}) => {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
      <SuggestInput
        label="Email"
        value={value}
        onValueChange={setValue}
        options={OPTIONS}
        onRemoveOption={onRemoveOption}
        removeHint="forget"
      />
    </form>
  );
};

afterEach(() => cleanup());

const field = () => screen.getByRole("combobox") as HTMLInputElement;
const optionLabels = () => screen.queryAllByRole("option").map((o) => o.textContent?.replace("✕", "") ?? "");

describe("SuggestInput", () => {
  test("suggests the matching address after a single character", async () => {
    render(<Harness />);
    await act(async () => { fireEvent.change(field(), { target: { value: "lev" } }); });

    expect(optionLabels()).toEqual(["levonbakunts@gmail.com"]);
  });

  test("matches anywhere in the address, case-insensitively", async () => {
    render(<Harness />);
    await act(async () => { fireEvent.change(field(), { target: { value: "CYBERPLACE" } }); });

    expect(optionLabels()).toEqual(["manager@cyberplace.pro", "owner@cyberplace.pro"]);
  });

  test("clicking a suggestion fills the field and closes the list", async () => {
    render(<Harness />);
    await act(async () => { fireEvent.change(field(), { target: { value: "lev" } }); });
    await act(async () => { fireEvent.click(screen.getByText("levonbakunts@gmail.com")); });

    expect(field().value).toBe("levonbakunts@gmail.com");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  test("keyboard picks a suggestion without submitting the form", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await act(async () => { fireEvent.focus(field()); });
    await act(async () => { fireEvent.keyDown(field(), { key: "ArrowDown" }); });
    await act(async () => { fireEvent.keyDown(field(), { key: "ArrowDown" }); });
    await act(async () => { fireEvent.keyDown(field(), { key: "Enter" }); });

    expect(field().value).toBe("manager@cyberplace.pro");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("Enter submits normally when no suggestion is highlighted", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await act(async () => { fireEvent.change(field(), { target: { value: "lev" } }); });
    await act(async () => { fireEvent.keyDown(field(), { key: "Enter" }); });

    // The keydown didn't preventDefault, so the surrounding form is free to submit.
    await act(async () => { fireEvent.submit(field().closest("form")!); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test("Escape closes the list but keeps what was typed", async () => {
    render(<Harness />);
    await act(async () => { fireEvent.change(field(), { target: { value: "lev" } }); });
    await act(async () => { fireEvent.keyDown(field(), { key: "Escape" }); });

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(field().value).toBe("lev");
  });

  test("the remove affordance reports the address instead of picking it", async () => {
    const onRemoveOption = vi.fn();
    render(<Harness onRemoveOption={onRemoveOption} />);
    await act(async () => { fireEvent.change(field(), { target: { value: "lev" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /forget/ })); });

    expect(onRemoveOption).toHaveBeenCalledWith("levonbakunts@gmail.com");
    expect(field().value).toBe("lev");
  });
});
