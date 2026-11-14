// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NotificationsProvider, useNotifications } from "./NotificationsContext";

/**
 * The feed the bell, the list and the ending-soon card all read (2026-10-25):
 * an event delivered twice is one row and one unread, and a badge that moved
 * without this panel hearing why re-reads the LIST, not just the count.
 */
const api = vi.hoisted(() => ({
  page: vi.fn(),
  count: vi.fn(),
}));
vi.mock("@/api/notifications", () => ({
  apiNotifications: (...a: unknown[]) => api.page(...a),
  apiNotificationsUnreadCount: (...a: unknown[]) => api.count(...a),
  apiMarkNotificationRead: vi.fn(),
  apiMarkAllNotificationsRead: vi.fn(),
  apiDeleteNotification: vi.fn(),
  apiDeleteAllNotifications: vi.fn(),
}));
// One user object, as AuthContext keeps it: the provider's callbacks key on it.
const auth = vi.hoisted(() => ({ value: { user: { id: 9, role: "manager" } } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/realtime/useRealtimeResync", () => ({ useRealtimeResync: () => {} }));
vi.mock("@/realtime/useRealtimeVersion", () => ({ useRealtimeVersion: () => 0 }));
const socket = vi.hoisted(() => ({ listener: null as null | ((p: unknown) => void), channel: "" }));
vi.mock("@/realtime/echo", () => ({
  getEcho: () => ({
    private: (name: string) => {
      socket.channel = name;
      return {
        listen: (_e: string, fn: (p: unknown) => void) => { socket.listener = fn; },
        stopListening: () => { socket.listener = null; },
      };
    },
  }),
}));

const row = (id: string) => ({
  id, type: "App\\Notifications\\SessionEndingSoon", read_at: null, created_at: "2026-10-25T12:00:00Z",
  data: { type: "session.ending_soon", session_id: 42, branch_id: 7, place_number: 8, ends_at: "2026-10-25T12:15:00Z" },
});
const page = (rows: unknown[], unread: number) => ({
  data: rows, meta: { current_page: 1, last_page: 1, per_page: 50, total: rows.length, unread_count: unread },
});

const Probe = () => {
  const { list, unreadCount } = useNotifications();
  return <div data-testid="probe">{`${list.length}|${unreadCount}|${list.map((n) => n.id).join(",")}`}</div>;
};
const probe = () => screen.getByTestId("probe").textContent;

const mount = async () => {
  await act(async () => {
    render(<NotificationsProvider><Probe /></NotificationsProvider>);
  });
};

describe("the notifications feed", () => {
  beforeEach(() => {
    api.page.mockReset();
    api.count.mockReset();
    socket.listener = null;
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  test("listens on the user's own private channel", async () => {
    api.page.mockResolvedValue(page([], 0));
    await mount();
    expect(socket.channel).toBe("user.9.notifications");
  });

  test("a new event adds one row and one unread", async () => {
    api.page.mockResolvedValue(page([], 0));
    await mount();
    await act(async () => { socket.listener?.(row("n1")); });
    expect(probe()).toBe("1|1|n1");
  });

  test("the same event delivered twice is one row and one unread", async () => {
    api.page.mockResolvedValue(page([], 0));
    await mount();
    await act(async () => { socket.listener?.(row("n1")); });
    await act(async () => { socket.listener?.(row("n1")); });
    expect(probe()).toBe("1|1|n1");
  });

  test("an event for a row the list already read is not counted again", async () => {
    api.page.mockResolvedValue(page([row("n1")], 1));
    await mount();
    await act(async () => { socket.listener?.(row("n1")); });
    expect(probe()).toBe("1|1|n1");
  });

  test("a badge that moved without an event re-reads the list", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.page.mockResolvedValueOnce(page([], 0));
    await mount();
    expect(probe()).toBe("0|0|");

    // The broadcast was missed; the server has the row.
    api.count.mockResolvedValue({ unread_count: 1 });
    api.page.mockResolvedValue(page([row("n1")], 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(probe()).toBe("1|1|n1");
  });

  test("a badge that agrees reads nothing more", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.page.mockResolvedValue(page([row("n1")], 1));
    await mount();
    api.count.mockResolvedValue({ unread_count: 1 });
    const reads = api.page.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(api.page.mock.calls.length).toBe(reads);
  });
});

/**
 * An admin's feed (2026-11-09) carries Cyber Place Platform payment notices
 * ONLY: whatever else their table holds is dropped from the list, the badge
 * and the push, and the badge counts what the admin can actually see.
 */
describe("the admin's feed", () => {
  const billing = (id: string, read = false) => ({
    id, type: "App\\Notifications\\PlatformBillingNotice", read_at: read ? "2026-11-09T10:00:00Z" : null, created_at: "2026-11-09T09:00:00Z",
    data: { type: "platform_billing.overdue_d2", invoice_id: 31, company_id: 4 },
  });
  const legacy = (id: string) => ({
    id, type: "App\\Notifications\\CompanyPaymentDue", read_at: null, created_at: "2026-11-09T09:00:00Z",
    data: { type: "company.payment_due", company_id: 4 },
  });

  beforeEach(() => {
    api.page.mockReset();
    api.count.mockReset();
    socket.listener = null;
    auth.value = { user: { id: 1, role: "admin" } };
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    auth.value = { user: { id: 9, role: "manager" } };
  });

  test("reads the feed and keeps only payment notices; the badge counts those", async () => {
    api.page.mockResolvedValue(page([legacy("x1"), billing("b1"), billing("b2", true), legacy("x2")], 4));
    await mount();
    expect(probe()).toBe("2|1|b1,b2");
  });

  test("a pushed row of another kind is ignored; a payment notice is added", async () => {
    api.page.mockResolvedValue(page([], 0));
    await mount();
    await act(async () => { socket.listener?.(legacy("x1")); });
    expect(probe()).toBe("0|0|");
    await act(async () => { socket.listener?.(billing("b1")); });
    expect(probe()).toBe("1|1|b1");
  });

  test("the poll compares the server's count with the server's count, not the filtered one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Server: 3 unread (2 hidden); the admin sees 1.
    api.page.mockResolvedValue(page([legacy("x1"), legacy("x2"), billing("b1")], 3));
    await mount();
    api.count.mockResolvedValue({ unread_count: 3 });
    const reads = api.page.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(api.page.mock.calls.length, "nothing moved: no re-read every minute").toBe(reads);
  });

  test("a manager's feed is not filtered", async () => {
    auth.value = { user: { id: 9, role: "manager" } };
    api.page.mockResolvedValue(page([legacy("x1"), billing("b1")], 2));
    await mount();
    expect(probe()).toBe("2|2|x1,b1");
  });
});
