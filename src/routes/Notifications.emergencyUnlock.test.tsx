// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A PC was unlocked with its emergency code (2026-11-28, backend
 * `AgentEmergencyUnlocked`): which PC, when, where, and what to do; a press
 * opens the branch's computers.
 */
vi.mock("@/api/client", () => ({ request: () => Promise.resolve({ data: [] }), apiCache: { subscribe: () => () => {} } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner", dashboard: {} } }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), lang: "ru", money: (n: number) => `${n} драм` }) };
});
const feed = vi.hoisted(() => ({ list: [] as unknown[], markRead: vi.fn(async () => {}) }));
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    list: feed.list, unreadCount: 1, loading: false, error: null, failure: null, settled: true,
    refresh: vi.fn(async () => {}), markRead: feed.markRead, markAllRead: vi.fn(), deleteOne: vi.fn(), deleteAll: vi.fn(),
  }),
}));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/repositories/ExpenseRepository", () => ({ expenseRepository: { reminders: () => Promise.resolve([]) } }));
vi.mock("@/components/ui/ScreenWithBg", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => nav.navigate }));

import Notifications from "./Notifications";

const row = {
  id: "e-1", type: "PC PC 7 was unlocked with the emergency code (Abovyan 1)", read_at: null, created_at: "2026-11-28T02:10:00+04:00",
  data: { type: "agent.emergency_unlock", pc_id: 12, pc_label: "PC 7", branch_id: 5, branch_address: "Abovyan 1", at: "2026-11-28T02:10:00+04:00" },
};

beforeEach(() => { nav.navigate.mockReset(); feed.markRead.mockClear(); });
afterEach(() => cleanup());

describe("agent.emergency_unlock", () => {
  test("says which PC, where, and what to do, in the panel's language", async () => {
    feed.list = [row];
    await act(async () => { render(<Notifications />); });
    expect(screen.getByText("🔓 ПК PC 7 разблокирован аварийным кодом")).toBeTruthy();
    const text = screen.getByTestId("notification-body").textContent!;
    expect(text).toContain("Abovyan 1");
    expect(text).toContain("Его код уже сменился");
  });

  test("a press marks it read and opens the branch's computers", async () => {
    feed.list = [row];
    await act(async () => { render(<Notifications />); });
    await act(async () => { fireEvent.click(screen.getByText("🔓 ПК PC 7 разблокирован аварийным кодом")); });
    expect(feed.markRead).toHaveBeenCalledWith("e-1");
    expect(nav.navigate).toHaveBeenCalledWith("/branches/5/pcs");
  });
});

describe("agent.no_session", () => {
  test("says the PC plays with no session and what was done; a press opens the computers", async () => {
    feed.list = [{ id: "n-2", type: "PC PC 3 is running with no session", read_at: null, created_at: "2026-11-28T12:01:01+04:00",
      data: { type: "agent.no_session", pc_id: 3, pc_label: "PC 3", branch_id: 5, branch_address: "Abovyan 1", at: "2026-11-28T12:01:01+04:00" } }];
    await act(async () => { render(<Notifications />); });
    expect(screen.getByText("⚠ ПК PC 3 работает без сеанса")).toBeTruthy();
    expect(screen.getByTestId("notification-body").textContent).toContain("Блокировка отправлена снова");
    await act(async () => { fireEvent.click(screen.getByText("⚠ ПК PC 3 работает без сеанса")); });
    expect(nav.navigate).toHaveBeenCalledWith("/branches/5/pcs");
  });
});
