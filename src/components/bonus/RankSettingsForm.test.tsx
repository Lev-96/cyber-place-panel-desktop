// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repo = vi.hoisted(() => ({ updateRanks: vi.fn() }));
vi.mock("@/repositories/BonusRepository", () => ({ bonusRepository: repo }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

import RankSettingsForm from "./RankSettingsForm";

const saved = vi.fn();
beforeEach(() => { repo.updateRanks.mockReset(); repo.updateRanks.mockResolvedValue({}); saved.mockReset(); });
afterEach(cleanup);

describe("RankSettingsForm", () => {
  test("by hours: the suggested ladder is sent as numbers", async () => {
    render(<RankSettingsForm branchId={7} settings={{ strategy: "none", thresholds: null }} onSaved={saved} />);
    await act(async () => { fireEvent.click(screen.getByTestId("rank-strategy-hours")); });
    await act(async () => { fireEvent.click(screen.getByTestId("rank-save")); });
    expect(repo.updateRanks).toHaveBeenCalledWith(7, { strategy: "hours", thresholds: { pro: 3, elite: 10, veteran: 30, legend: 100 } });
  });

  test("a rank that does not rise cannot be saved", async () => {
    render(<RankSettingsForm branchId={7} settings={{ strategy: "visits", thresholds: { pro: 2, elite: 5, veteran: 10, legend: 20 } }} onSaved={saved} />);
    await act(async () => { fireEvent.change(screen.getByTestId("rank-threshold-elite"), { target: { value: "2" } }); });
    expect((screen.getByTestId("rank-save") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("bonus.rank.mustRise")).toBeTruthy();
  });

  test("own names (2026-11-25): typed ones sent, empty = standard; the chips show them", async () => {
    const names = { gamer: "GAMER", pro: "PRO", elite: "ELITE", veteran: "VETERAN", legend: "LEGEND" };
    render(<RankSettingsForm branchId={7} settings={{ strategy: "hours", thresholds: { pro: 1, elite: 3, veteran: 10, legend: 50 }, names }} onSaved={saved} />);
    await act(async () => { fireEvent.change(screen.getByTestId("rank-name-legend"), { target: { value: "Король клуба" } }); });
    expect(screen.getAllByText("Король клуба").length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(screen.getByTestId("rank-save")); });
    expect(repo.updateRanks).toHaveBeenCalledWith(7, { strategy: "hours", thresholds: { pro: 1, elite: 3, veteran: 10, legend: 50 },
      names: { gamer: "", pro: "", elite: "", veteran: "", legend: "Король клуба" } });
  });

  test("an older server (no names in its answer): no name fields, none sent", async () => {
    render(<RankSettingsForm branchId={7} settings={{ strategy: "none", thresholds: null }} onSaved={saved} />);
    expect(screen.queryByTestId("rank-names")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("rank-save")); });
    expect(repo.updateRanks).toHaveBeenCalledWith(7, { strategy: "none" });
  });

  test("no ranks: only the strategy is sent", async () => {
    render(<RankSettingsForm branchId={7} settings={{ strategy: "spent", thresholds: { pro: 1, elite: 2, veteran: 3, legend: 4 } }} onSaved={saved} />);
    await act(async () => { fireEvent.click(screen.getByTestId("rank-strategy-none")); });
    await act(async () => { fireEvent.click(screen.getByTestId("rank-save")); });
    expect(repo.updateRanks).toHaveBeenCalledWith(7, { strategy: "none" });
  });
});
