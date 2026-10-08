// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
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
