// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A player rated the club after a visit (2026-11-27, backend
 * `ClubRatedByPlayer`): the stars, who, what they picked and their words in
 * the panel's language; a press opens the branch's bonus cards.
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
  id: "r-1", type: "Arman оценил(а) клуб: 2 из 5 (Abovyan 1)", read_at: null, created_at: "2026-11-27T12:31:00+04:00",
  data: { type: "bonus.club_rated", rating_id: 3, branch_id: 5, branch_address: "Abovyan 1", company_name: "Arena", account_id: 9,
    player_name: "Arman", stars: 2, tags: ["laggy_pcs", "noisy"], comment: "ПК тормозил" },
};

beforeEach(() => { nav.navigate.mockReset(); feed.markRead.mockClear(); });
afterEach(() => cleanup());

describe("bonus.club_rated", () => {
  test("reads as stars, who, what they picked, their words and where", async () => {
    feed.list = [row];
    await act(async () => { render(<Notifications />); });
    expect(screen.getByText("★★☆☆☆ Arman оценил(а) клуб")).toBeTruthy();
    const text = screen.getByTestId("notification-body").textContent!;
    expect(text).toContain("ПК тормозили, Слишком шумно");
    expect(text).toContain("«ПК тормозил»");
    expect(text).toContain("Arena · Abovyan 1");
  });

  test("a press marks it read and opens the branch's bonus cards", async () => {
    feed.list = [row];
    await act(async () => { render(<Notifications />); });
    await act(async () => { fireEvent.click(screen.getByText("★★☆☆☆ Arman оценил(а) клуб")); });
    expect(feed.markRead).toHaveBeenCalledWith("r-1");
    expect(nav.navigate).toHaveBeenCalledWith("/branches/5/bonus");
  });
});
