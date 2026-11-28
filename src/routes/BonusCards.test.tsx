// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const repo = vi.hoisted(() => ({ settings: vi.fn(), list: vi.fn(), remove: vi.fn(), freeze: vi.fn(), setRank: vi.fn(), rate: vi.fn() }));
const asked = vi.hoisted(() => ({ answer: true, question: "" }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async (q: string) => { asked.question = q; return asked.answer; } }));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: { settings: (...a: unknown[]) => repo.settings(...a), list: (...a: unknown[]) => repo.list(...a), remove: (...a: unknown[]) => repo.remove(...a),
    freeze: (...a: unknown[]) => repo.freeze(...a), setRank: (...a: unknown[]) => repo.setRank(...a), rate: (...a: unknown[]) => repo.rate(...a) },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock("@/components/bonus/RegisterBonusDialog", () => ({ default: () => null }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => (k === "bonus.balance" ? "Bonuses: {0}" : k), money: (n: number, o?: { minimumFractionDigits?: number }) => (o?.minimumFractionDigits === 2 ? n.toFixed(2) : String(Math.round(n))) }) }));

import BonusCards from "./BonusCards";

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter initialEntries={["/branches/7/bonus"]}><Routes><Route path="/branches/:branchId/bonus" element={<BonusCards />} /></Routes></MemoryRouter>);
  });
};
afterEach(() => cleanup());
beforeEach(() => { repo.settings.mockReset(); repo.list.mockReset(); auth.role = "company_owner"; });

describe("«Бонусные карты»", () => {
  test("the owner sees the cards with their ranks and the way to «Настройки бонусной карты»", async () => {
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([{ id: 1, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "35.00", opened_at: null, rank: "elite" }]);
    await mount();
    expect(screen.getByTestId("bonus-settings-link").getAttribute("href")).toBe("/branches/7/bonus/settings");
    expect(screen.getByText("Arman")).toBeTruthy();
    expect(screen.getByTestId("rank-badge").getAttribute("data-rank")).toBe("elite");
    expect(repo.list).toHaveBeenCalledWith(7, undefined);
    expect((screen.getByTestId("bonus-register-open") as HTMLButtonElement).disabled).toBe(false);
  });

  test("a card's bonuses are shown to the cent, never rounded (2026-11-25, owner: 1:1)", async () => {
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([
      { id: 1, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "43.89", opened_at: null, rank: "gamer" },
      { id: 2, branch_id: 7, name: "Ani", phone: "+37491123457", balance: "300.00", opened_at: null, rank: "gamer" },
    ]);
    await mount();
    expect(screen.getByText("Bonuses: 43.89")).toBeTruthy();
    expect(screen.getByText("Bonuses: 300")).toBeTruthy();
  });

  test("a manager never sees the rule", async () => {
    auth.role = "manager";
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([]);
    await mount();
    expect(screen.queryByTestId("bonus-settings-link")).toBeNull();
    expect(screen.getByText("bonus.state.emptyTitle")).toBeTruthy();
  });

  test("switched off: registering is not offered", async () => {
    repo.settings.mockResolvedValue({ enabled: false, percent: "0.00", welcome: "0.00" });
    repo.list.mockResolvedValue([]);
    await mount();
    expect((screen.getByTestId("bonus-register-open") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("bonus.disabledHint").length).toBeGreaterThan(0);
  });

  test("«Удалить» (2026-11-25): asked first; yes → removed and the list read again; no → nothing", async () => {
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([{ id: 3, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "35.00", opened_at: null }]);
    repo.remove.mockResolvedValue({ deleted: true });
    asked.answer = false;
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-remove-3")); });
    expect(asked.question).toContain("bonus.remove.confirm");
    expect(repo.remove).not.toHaveBeenCalled();
    asked.answer = true;
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-remove-3")); });
    expect(repo.remove).toHaveBeenCalledWith(7, 3);
    expect(repo.list.mock.calls.length).toBeGreaterThan(1);
  });

  test("the owner freezes and lowers the rank (2026-11-26); asked first; the list is read again", async () => {
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00", rating: { average: "4.5", count: 2 } });
    repo.list.mockResolvedValue([{ id: 4, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "35.00", opened_at: null, rank: "elite", frozen: false, rank_held: false, club_stars: null, player_rating: { average: "4.0", count: 3 } }]);
    repo.freeze.mockResolvedValue({}); repo.setRank.mockResolvedValue({}); repo.rate.mockResolvedValue({});
    asked.answer = true;
    await mount();
    expect(screen.getByTestId("bonus-club-rating").textContent).toBe("bonus.rating.club");
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-freeze-4")); });
    expect(asked.question).toContain("bonus.freeze.confirm");
    expect(repo.freeze).toHaveBeenCalledWith(7, 4, true);
    const select = screen.getByTestId("bonus-rank-4") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["", "gamer", "pro"]);
    await act(async () => { fireEvent.change(select, { target: { value: "pro" } }); });
    expect(repo.setRank).toHaveBeenCalledWith(7, 4, "pro");
    // Ratings are given after a visit only (2026-11-27): none here yet, no stars to tap.
    expect(screen.queryByTestId("bonus-stars-4")).toBeNull();
    expect(repo.list.mock.calls.length).toBeGreaterThan(2);
  });

  test("a frozen card with a held rank: «Разморозить» at once (no question) and «Вернуть автоматический»", async () => {
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([{ id: 5, branch_id: 7, name: "Ani", phone: "+37491123457", balance: "10.00", opened_at: null, rank: "gamer", frozen: true, rank_held: true, club_stars: 2 }]);
    repo.freeze.mockResolvedValue({}); repo.setRank.mockResolvedValue({});
    asked.question = "";
    await mount();
    expect(screen.getByTestId("bonus-frozen-5")).toBeTruthy();
    expect(screen.getByTestId("bonus-rank-held-5")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-freeze-5")); });
    expect(asked.question).toBe("");
    expect(repo.freeze).toHaveBeenCalledWith(7, 5, false);
    const select = screen.getByTestId("bonus-rank-5") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["", "auto"]);
    await act(async () => { fireEvent.change(select, { target: { value: "auto" } }); });
    expect(repo.setRank).toHaveBeenCalledWith(7, 5, null);
  });

  test("a manager never freezes or lowers a rank; both sides' ratings are shown, never set here (2026-11-27)", async () => {
    auth.role = "manager";
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([{ id: 6, branch_id: 7, name: "Ani", phone: "+37491123457", balance: "10.00", opened_at: null, rank: "pro",
      club_stars: 2, club_comment: "Шумел", player_stars: 4, player_tags: ["fast_pcs"], player_comment: "Хорошо" }]);
    await mount();
    expect(screen.queryByTestId("bonus-freeze-6")).toBeNull();
    expect(screen.queryByTestId("bonus-rank-6")).toBeNull();
    const stars = screen.getByTestId("bonus-stars-6");
    expect(stars.getAttribute("role")).toBe("img");
    expect(stars.querySelectorAll("button")).toHaveLength(0);
    const fromPlayer = screen.getByTestId("bonus-player-stars-6").textContent ?? "";
    expect(fromPlayer).toContain("fast_pcs");
    expect(fromPlayer).toContain("«Хорошо»");
    expect(repo.rate).not.toHaveBeenCalled();
  });
});
