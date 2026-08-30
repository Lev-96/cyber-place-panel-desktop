// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import BranchPicker from "./BranchPicker";
import type { IBranchApi } from "@/types/api";

/**
 * The picker replaced a `<select>` of addresses, which was unreadable the
 * moment two branches shared a street. What matters now is that it stays
 * usable as the list grows: the search has to match on whichever of company,
 * address or city the operator remembers, and a search that matches nothing
 * has to say so rather than render an empty grid.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "ru" }),
}));
vi.mock("@/infrastructure/AppConfig", () => ({ storageUri: () => null }));

const branch = (id: number, address: string, company: string, city = "Yerevan"): IBranchApi => ({
  id,
  address,
  city,
  country: "Armenia",
  company: { id: 1, name: company },
} as unknown as IBranchApi);

const many = [
  branch(1, "Abovyan 5", "Neon Arena"),
  branch(2, "Abovyan 7", "Neon Arena"),
  branch(3, "Mashtots 12", "Pixel Club"),
  branch(4, "Tumanyan 3", "Pixel Club", "Gyumri"),
  branch(5, "Sayat-Nova 1", "Retro Bay"),
  branch(6, "Baghramyan 9", "Retro Bay"),
];

afterEach(cleanup);

describe("BranchPicker", () => {
  test("every branch is a card, and picking one reports its id", () => {
    const onPick = vi.fn();
    render(<BranchPicker branches={many} selectedId={null} onPick={onPick} />);

    expect(screen.getAllByRole("button")).toHaveLength(6);
    fireEvent.click(screen.getByText("Mashtots 12"));
    expect(onPick).toHaveBeenCalledWith(3);
  });

  test("the selected branch is marked as pressed, not merely coloured", () => {
    render(<BranchPicker branches={many} selectedId={4} onPick={vi.fn()} />);

    const pressed = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain("Tumanyan 3");
  });

  test("search matches the company, the address and the city alike", () => {
    render(<BranchPicker branches={many} selectedId={null} onPick={vi.fn()} />);
    const box = screen.getByPlaceholderText("support.searchBranch");

    fireEvent.change(box, { target: { value: "pixel" } });
    expect(screen.getAllByRole("button", { name: /Mashtots|Tumanyan/ })).toHaveLength(2);

    fireEvent.change(box, { target: { value: "abovyan 7" } });
    expect(screen.getByText("Abovyan 7")).toBeTruthy();
    expect(screen.queryByText("Abovyan 5")).toBeNull();

    fireEvent.change(box, { target: { value: "gyumri" } });
    expect(screen.getByText("Tumanyan 3")).toBeTruthy();
    expect(screen.queryByText("Mashtots 12")).toBeNull();
  });

  test("a search that matches nothing says so", () => {
    render(<BranchPicker branches={many} selectedId={null} onPick={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("support.searchBranch"), { target: { value: "zzz" } });

    expect(screen.getByText("support.noBranchMatches")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("a short list gets no search box — one more thing to look past", () => {
    render(<BranchPicker branches={many.slice(0, 3)} selectedId={null} onPick={vi.fn()} />);
    expect(screen.queryByPlaceholderText("support.searchBranch")).toBeNull();
  });

  test("while a thread is being opened the cards do not take a second click", () => {
    const onPick = vi.fn();
    render(<BranchPicker branches={many} selectedId={null} onPick={onPick} busy />);

    fireEvent.click(screen.getByText("Abovyan 5"));
    expect(onPick).not.toHaveBeenCalled();
  });
});
