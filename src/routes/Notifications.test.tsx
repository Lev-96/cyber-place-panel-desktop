// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ICompanyBilling } from "@/api/billing";
import Notifications, { shouldShowBookingsFeed, shouldShowBillingFeed } from "./Notifications";

/**
 * Regression-shield for the role gate that decides whether the
 * "Bookings" feed section renders on the Уведомления screen.
 *
 * Manager only — admin and company_owner are scoped to billing-only
 * by product (2026-05-29). Mirrors the backend
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
  test("company_owner does NOT see Bookings feed", () => {
    expect(shouldShowBookingsFeed("company_owner")).toBe(false);
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
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    list: [],
    unreadCount: 0,
    loading: false,
    error: null,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteOne: vi.fn(),
    deleteAll: vi.fn(),
  }),
}));
vi.mock("@/repositories/ExpenseRepository", () => ({
  expenseRepository: { reminders: () => Promise.resolve([]) },
}));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

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
