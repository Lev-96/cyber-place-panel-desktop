// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ICompanyBilling } from "@/api/billing";
import Notifications, { dbFeedCopy, shouldShowBookingsFeed, shouldShowBillingFeed } from "./Notifications";

/**
 * Regression-shield for the role gate that decides whether the
 * "Bookings" feed section renders on the Уведомления screen.
 *
 * Manager, and since 2026-10-12 the owner too (whose rows are only "a seat
 * ends soon"); admin stays billing-only. Mirrors the backend
 * `StaffNotificationDispatcher` allowlist and the corner-popup gate
 * in `GlobalBookingNotifier.shouldShowBookingToasts`.
 */
describe("shouldShowBookingsFeed", () => {
  test("manager sees Bookings feed", () => {
    expect(shouldShowBookingsFeed("manager")).toBe(true);
  });
  test("admin does NOT see Bookings feed", () => {
    expect(shouldShowBookingsFeed("admin")).toBe(false);
  });
  test("company_owner sees the feed, named for sessions", () => {
    expect(shouldShowBookingsFeed("company_owner")).toBe(true);
    expect(dbFeedCopy("company_owner").titleKey).toBe("notifications.sessionFeedTitle");
    expect(dbFeedCopy("manager").titleKey).toBe("notifications.bookingFeedTitle");
  });
  test("undefined role does NOT see Bookings feed", () => {
    expect(shouldShowBookingsFeed(undefined)).toBe(false);
  });
});

describe("shouldShowBillingFeed", () => {
  test("admin sees Billing feed", () => {
    expect(shouldShowBillingFeed("admin")).toBe(true);
  });
  test("company_owner sees Billing feed", () => {
    expect(shouldShowBillingFeed("company_owner")).toBe(true);
  });
  test("manager does NOT see Billing feed", () => {
    expect(shouldShowBillingFeed("manager")).toBe(false);
  });
  test("undefined role does NOT see Billing feed", () => {
    expect(shouldShowBillingFeed(undefined)).toBe(false);
  });
});

/**
 * Which billing endpoint each role's Уведомления screen actually reaches.
 *
 * The owner's screen used to ask for `/company-billing/reminders`, which is the
 * ADMIN's cross-tenant list of every company that owes money - name, email and
 * commission of other people's businesses. The backend refuses it (403), and
 * because the reminder feed is the owner's only section on this screen, that
 * refusal replaced the whole page with "У вас нет прав на это действие".
 *
 * The owner-scoped door has always existed - `/company/{id}/billing`, the same
 * payload `CompanyBillingResource` serves the "My company" card - and
 * `ReminderCard` has always had a non-admin branch that says "you must pay".
 * These tests pin the wiring: an owner reads their OWN company and never the
 * admin list, and an admin is unchanged.
 */
const api = vi.hoisted(() => ({
  calls: [] as string[],
  handler: (_path: string): Promise<unknown> => Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string) => {
    api.calls.push(path);
    return api.handler(path);
  },
  apiCache: { subscribe: () => () => {} },
}));

const auth = vi.hoisted(() => ({
  user: {} as { id: number; role: string; dashboard?: { company_id?: number } },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
const feed = vi.hoisted(() => ({ list: [] as unknown[], deleteAll: vi.fn(), failure: null as unknown, refresh: vi.fn(async () => {}) }));
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    list: feed.list,
    unreadCount: 0,
    loading: false,
    error: feed.failure ? "failed" : null,
    failure: feed.failure,
    settled: true,
    refresh: feed.refresh,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteOne: vi.fn(),
    deleteAll: feed.deleteAll,
  }),
}));
const asked = vi.hoisted(() => ({ fn: vi.fn(async (_m: string, _o?: unknown) => false) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => asked.fn }));
vi.mock("@/repositories/ExpenseRepository", () => ({
  expenseRepository: { reminders: () => Promise.resolve([]) },
}));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const nav = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => nav.fn }));

const OWN_BILLING: ICompanyBilling = {
  company_id: 7,
  commission_percent: 10,
  last_paid_at: "2026-08-01T00:00:00+04:00",
  next_due_at: "2026-09-14T00:00:00+04:00",
  days_until_due: 2,
  is_overdue: false,
  status: "active",
};

describe("Notifications billing feed, per role", () => {
  beforeEach(() => {
    api.calls = [];
    api.handler = () => Promise.reject(new Error("no handler"));
  });
  afterEach(cleanup);

  test("an owner reads their own company, never the admin list", async () => {
    auth.user = { id: 5, role: "company_owner", dashboard: { company_id: 7 } };
    api.handler = (path) =>
      path === "/company/7/billing"
        ? Promise.resolve(OWN_BILLING)
        : Promise.reject(new Error(`unexpected ${path}`));

    render(<Notifications />);

    await waitFor(() => expect(api.calls).toContain("/company/7/billing"));
    expect(api.calls).not.toContain("/company-billing/reminders");
    expect(await screen.findByText(/you must pay Cyber Place/i)).toBeTruthy();
  });

  test("an admin still reads the cross-company reminder list", async () => {
    auth.user = { id: 1, role: "admin" };
    api.handler = (path) =>
      path === "/company-billing/reminders"
        ? Promise.resolve({ data: [] })
        : Promise.reject(new Error(`unexpected ${path}`));

    render(<Notifications />);

    await waitFor(() => expect(api.calls).toContain("/company-billing/reminders"));
    expect(api.calls.some((p) => p.startsWith("/company/"))).toBe(false);
  });

  test("an owner with nothing due soon gets the empty state, not a card", async () => {
    auth.user = { id: 5, role: "company_owner", dashboard: { company_id: 7 } };
    api.handler = () => Promise.resolve({ ...OWN_BILLING, days_until_due: 30, is_overdue: false });

    render(<Notifications />);

    await waitFor(() => expect(api.calls).toContain("/company/7/billing"));
    expect(screen.queryByText(/you must pay Cyber Place/i)).toBeNull();
  });

  test("an owner whose account carries no company asks the backend nothing", async () => {
    auth.user = { id: 5, role: "company_owner" };
    api.handler = (path) => Promise.reject(new Error(`unexpected ${path}`));

    render(<Notifications />);

    await waitFor(() => expect(screen.getByText(/Billing/i)).toBeTruthy());
    expect(api.calls).toEqual([]);
  });
});

/**
 * "Clear all" asks through the app's own destructive dialog (2026-09-28), not
 * `window.confirm`, which poisons the Electron renderer's focus.
 */
describe("Notifications clear all", () => {
  beforeEach(() => {
    auth.user = { id: 1, role: "manager" };
    api.handler = () => Promise.resolve({ data: [] });
    feed.list = [{ id: "n1", type: "App\\Notifications\\BookingCreated", data: {}, read_at: null, created_at: "2026-09-28T10:00:00+04:00" }];
    feed.deleteAll.mockClear();
    asked.fn.mockClear();
  });
  afterEach(() => { cleanup(); feed.list = []; });

  const clearAll = () => fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

  test("asks with the destructive dialog and deletes nothing on No", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => { throw new Error("native confirm used"); });
    asked.fn.mockResolvedValueOnce(false);
    render(<Notifications />);
    clearAll();
    await waitFor(() => expect(asked.fn).toHaveBeenCalledTimes(1));
    expect(asked.fn.mock.calls[0][0]).toBe("Delete all notifications? This cannot be undone.");
    expect(asked.fn.mock.calls[0][1]).toMatchObject({ destructive: true });
    expect(feed.deleteAll).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  test("deletes everything once confirmed", async () => {
    asked.fn.mockResolvedValueOnce(true);
    render(<Notifications />);
    clearAll();
    await waitFor(() => expect(feed.deleteAll).toHaveBeenCalledTimes(1));
  });
});

/**
 * Each feed answers for itself (2026-10-07): one that could not be read is
 * its error with Retry — never "No notifications right now", and never the
 * whole screen replaced by a red line.
 */
describe("Notifications states", () => {
  beforeEach(() => {
    api.calls = [];
    feed.list = [];
    feed.failure = null;
    feed.refresh.mockClear();
  });
  afterEach(() => { cleanup(); feed.failure = null; });

  test("a manager whose feed failed sees the error with Retry, not «no notifications»", async () => {
    auth.user = { id: 1, role: "manager" };
    feed.failure = new TypeError("Failed to fetch");
    render(<Notifications />);

    expect(screen.getByText("No connection")).toBeTruthy();
    expect(screen.queryByText("No notifications right now")).toBeNull();
    // Opening the list reads it once (2026-10-25); Retry reads it again.
    const opened = feed.refresh.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(feed.refresh).toHaveBeenCalledTimes(opened + 1);
  });

  test("opening the list reads it again, exactly once", async () => {
    auth.user = { id: 1, role: "manager" };
    const before = feed.refresh.mock.calls.length;
    render(<Notifications />);
    expect(feed.refresh.mock.calls.length - before).toBe(1);
  });

  test("a manager with an empty feed gets the empty state", async () => {
    auth.user = { id: 1, role: "manager" };
    render(<Notifications />);

    expect(screen.getByText("No notifications right now")).toBeTruthy();
  });

  test("an owner whose billing read failed sees that feed's error, the title still there", async () => {
    auth.user = { id: 5, role: "company_owner", dashboard: { company_id: 7 } };
    api.handler = () => Promise.reject(Object.assign(new Error("Server Error"), { status: 500, body: { message: "Server Error" } }));
    render(<Notifications />);

    expect(await screen.findByText("Could not load notifications")).toBeTruthy();
    expect(screen.getByText(/Billing/i)).toBeTruthy();
    // The one empty state is the owner's own (empty) Active Places feed; billing
    // shows its error, never "nothing due".
    expect(screen.getAllByText("No notifications right now")).toHaveLength(1);
    expect(screen.getByText("Seats whose session ends in 15 minutes appear here.")).toBeTruthy();
  });
});

/** "A seat ends in 15 minutes" in the staff feed (2026-10-12). */
describe("the session-ending-soon card", () => {
  const row = {
    id: "n1", type: "App\\Notifications\\SessionEndingSoon", read_at: null, created_at: "2026-10-12T13:45:00Z",
    data: {
      type: "session.ending_soon", session_id: 9, branch_id: 4, place_number: 3, minutes_left: 15,
      ends_at: "2026-10-12T18:00:00", company_name: "Club", branch_address: "Abovyan 1",
    },
  };
  beforeEach(() => { feed.list = [row]; nav.fn.mockReset(); api.handler = () => Promise.resolve({ data: [] }); });
  afterEach(() => { cleanup(); feed.list = []; });

  test("says which seat, how long, when it ends and where; opens the branch's sessions", async () => {
    auth.user = { id: 2, role: "manager" };
    render(<Notifications />);

    expect(screen.getByText("Seat №3: session ends in 15 min")).toBeTruthy();
    expect(screen.getByText("Ends at 18:00 · Club · Abovyan 1")).toBeTruthy();
    fireEvent.click(screen.getByText("Seat №3: session ends in 15 min"));
    expect(nav.fn).toHaveBeenCalledWith("/branches/4/sessions");
  });

  test("an owner sees it under Active Places", async () => {
    auth.user = { id: 5, role: "company_owner", dashboard: { company_id: 7 } };
    render(<Notifications />);

    expect(screen.getByText("Active Places")).toBeTruthy();
    expect(screen.queryByText("Bookings")).toBeNull();
    expect(screen.getByText("Seat №3: session ends in 15 min")).toBeTruthy();
    await waitFor(() => expect(api.calls.length).toBeGreaterThan(0));
  });
});
