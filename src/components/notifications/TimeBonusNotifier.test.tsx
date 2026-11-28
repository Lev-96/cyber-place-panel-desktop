// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ITimeBonusWin } from "@/types/bonus";

/**
 * «Бонус времени» (2026-11-25): a seat with a limit won free minutes; the
 * window names the seat, the player and the minutes, and sends the one answer
 * given. Nothing is computed here.
 */
const repo = vi.hoisted(() => ({ pendingTimeBonus: vi.fn(), grantTimeBonus: vi.fn(), declineTimeBonus: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "manager" }));
vi.mock("@/repositories/BonusRepository", () => ({ bonusRepository: repo }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => `${k} {0}`, money: (n: number) => `${n}` }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import TimeBonusNotifier from "./TimeBonusNotifier";

const win = (over: Partial<ITimeBonusWin> = {}): ITimeBonusWin => ({
  id: 3, branch_id: 1, session_id: 7, minutes: 30, drawn_at: "2026-11-25T14:00:00+04:00",
  place: { id: 4, number: 4, name: "VIP" }, player: "Arman", ends_at: "2026-11-25T15:00:00+04:00", ...over,
});
const mount = async () => { await act(async () => { render(<TimeBonusNotifier />); }); await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  auth.role = "manager";
  for (const f of Object.values(repo)) f.mockReset();
  repo.pendingTimeBonus.mockResolvedValue([win()]);
  repo.grantTimeBonus.mockResolvedValue({ id: 7 });
  repo.declineTimeBonus.mockResolvedValue({ declined: true });
});
afterEach(cleanup);

describe("TimeBonusNotifier", () => {
  test("names the seat, the player and the minutes", async () => {
    await mount();
    expect(screen.getByTestId("time-bonus-seat").textContent).toContain("4");
    expect(screen.getByTestId("time-bonus-seat").textContent).toContain("VIP");
    expect(screen.getByTestId("time-bonus-player").textContent).toBe("Arman");
    expect(screen.getByTestId("time-bonus-prize").textContent).toContain("30");
  });

  test("no Club Card on the seat: no player line", async () => {
    repo.pendingTimeBonus.mockResolvedValue([win({ player: null })]);
    await mount();
    expect(screen.queryByTestId("time-bonus-player")).toBeNull();
  });

  test("«Начислить» grants this win once, and the window closes", async () => {
    repo.pendingTimeBonus.mockResolvedValueOnce([win()]).mockResolvedValue([]);
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-grant")); });
    expect(repo.grantTimeBonus).toHaveBeenCalledTimes(1);
    expect(repo.grantTimeBonus).toHaveBeenCalledWith(3);
    expect(repo.declineTimeBonus).not.toHaveBeenCalled();
    expect(screen.queryByTestId("time-bonus")).toBeNull();
  });

  test("«Отказаться» declines, never grants", async () => {
    repo.pendingTimeBonus.mockResolvedValueOnce([win()]).mockResolvedValue([]);
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-decline")); });
    expect(repo.declineTimeBonus).toHaveBeenCalledWith(3);
    expect(repo.grantTimeBonus).not.toHaveBeenCalled();
  });

  test("a refusal shows the server's sentence and keeps the window", async () => {
    repo.grantTimeBonus.mockRejectedValue(new Error("The session is paused."));
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-grant")); });
    expect(screen.getByTestId("time-bonus-error").textContent).toBe("The session is paused.");
    expect(screen.getByTestId("time-bonus")).toBeTruthy();
  });

  test("a Club Card on the seat: the window says the player was asked too", async () => {
    repo.pendingTimeBonus.mockResolvedValue([win({ asked_player: true })]);
    await mount();
    expect(screen.getByTestId("time-bonus-asked-player")).toBeTruthy();
    expect(screen.getByTestId("time-bonus-grant")).toBeTruthy();
  });

  test("the player took it in the app (2026-11-25): told, «Понятно» hides it for THIS person only — nothing granted again", async () => {
    localStorage.clear();
    repo.pendingTimeBonus.mockResolvedValue([win({ status: "granted", answered_by: "player" })]);
    await mount();
    expect(screen.getByTestId("time-bonus-player-answer").textContent).toContain("timeBonus.playerTook");
    expect(screen.queryByTestId("time-bonus-grant")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-seen")); });
    expect(repo.grantTimeBonus).not.toHaveBeenCalled();
    expect(screen.queryByTestId("time-bonus-player-answer")).toBeNull();
    expect(localStorage.getItem("u1:cp.timeBonus.seen")).toBe("[3]");
    // Read again (the server still lists it): this person is not asked twice…
    cleanup();
    await mount();
    expect(screen.queryByTestId("time-bonus-player-answer")).toBeNull();
    // …another person on the same branch still is.
    cleanup();
    localStorage.removeItem("u1:cp.timeBonus.seen");
    await mount();
    expect(screen.getByTestId("time-bonus-player-answer")).toBeTruthy();
  });

  test("the player declined: said as declined", async () => {
    repo.pendingTimeBonus.mockResolvedValue([win({ status: "declined", answered_by: "player" })]);
    await mount();
    expect(screen.getByTestId("time-bonus-player-answer").textContent).toContain("timeBonus.playerDeclined");
  });

  test("a cashier is never asked, and nothing is read", async () => {
    auth.role = "cashier";
    await mount();
    expect(screen.queryByTestId("time-bonus")).toBeNull();
    expect(repo.pendingTimeBonus).not.toHaveBeenCalled();
  });
});
