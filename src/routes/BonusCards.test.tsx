// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const repo = vi.hoisted(() => ({ settings: vi.fn(), list: vi.fn(), remove: vi.fn() }));
const asked = vi.hoisted(() => ({ answer: true, question: "" }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async (q: string) => { asked.question = q; return asked.answer; } }));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: { settings: (...a: unknown[]) => repo.settings(...a), list: (...a: unknown[]) => repo.list(...a), remove: (...a: unknown[]) => repo.remove(...a) },
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
});
