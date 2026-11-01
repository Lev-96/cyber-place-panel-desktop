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
