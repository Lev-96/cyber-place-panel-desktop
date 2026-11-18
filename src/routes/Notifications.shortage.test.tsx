// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The owner's bell row for a shortage at a shift's acceptance (2026-11-18,
 * backend `ShiftStockShortage`): readable in the panel's language, the
 * server's sums, and a press opens that shift's report.
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

const row = (data: Record<string, unknown>) => ({
  id: "x-1", type: "Недостача при приёме смены: 500.00 AMD (Abovyan 1), смена: Anna", read_at: null, created_at: "2026-11-18T12:31:00+04:00",
  data: {
    type: "shift.stock_shortage", branch_id: 1, branch_address: "Abovyan 1", company_name: "Arena", shift_id: 42, previous_shift_id: 41,
    total_value: "500.00", currency: "AMD", items: [{ name: "Cola", diff: -1, value: "500.00" }], items_total: 1, blamed_user_name: "Anna",
    window_from: "2026-11-17T10:00:00+04:00", window_to: "2026-11-17T12:00:00+04:00",
    gap: { from: "2026-11-17T12:00:00+04:00", to: "2026-11-18T12:30:00+04:00", seconds: 88200, notable: true },
    ...data,
  },
});

beforeEach(() => { nav.navigate.mockReset(); feed.markRead.mockClear(); });
afterEach(() => cleanup());

describe("shift.stock_shortage", () => {
  test("reads as a sentence with the server's sum, the branch, whose shift and when", async () => {
    feed.list = [row({})];
    await act(async () => { render(<Notifications />); });
    expect(screen.getByText("⚠ Պակասորդ՝ 500 դրամ")).toBeTruthy();
    const body = screen.getByTestId("notification-body").textContent!;
    // Always Armenian, in a few words (2026-11-18, owner).
    expect(body).toContain("Abovyan 1 · հերթափոխ՝ Anna, 17.11 10:00–12:00");
    expect(body).toContain("Cola՝ 1 հատ");
    expect(body).toContain("Բաց հերթափոխ չի եղել 17.11 12:00 – 18.11 12:30");
    expect(body).not.toContain("—");
  });

  test("a press marks it read and opens that shift's report", async () => {
    feed.list = [row({})];
    await act(async () => { render(<Notifications />); });
    await act(async () => { fireEvent.click(screen.getByText("⚠ Պակասորդ՝ 500 դրամ")); });
    expect(feed.markRead).toHaveBeenCalledWith("x-1");
    expect(nav.navigate).toHaveBeenCalledWith("/shifts?shift_id=42");
  });

  test("no gap line when the gap is short; more products said as «и ещё N»", async () => {
    feed.list = [row({
      gap: { from: "x", to: "y", seconds: 60, notable: false },
      items: [1, 2, 3, 4].map((i) => ({ name: `P${i}`, diff: -i, value: "100.00" })), items_total: 6,
    })];
    await act(async () => { render(<Notifications />); });
    const body = screen.getByTestId("notification-body").textContent!;
    expect(body).not.toContain("Բաց հերթափոխ");
    expect(body).toContain("P1՝ 1 հատ, P2՝ 2 հատ, P3՝ 3 հատ, և ևս 3 ապրանք");
  });
});
