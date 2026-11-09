// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TRANSLATIONS } from "@/i18n/translations";
import { centsWhenFractional, moneyDisplay } from "@/i18n/currency";

/**
 * Cyber Place Platform payment notices in the feed (2026-11-09): rendered in
 * ARMENIAN with the owner's titles whatever language the panel is in, in the
 * Billing section (not the seats feed), each with Details opening the invoice.
 * On a backend with platform invoices the old client-computed reminder steps
 * aside, so the same debt is not announced twice.
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
const auth = vi.hoisted(() => ({ user: {} as { id: number; role: string; dashboard?: { company_id?: number } } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
// The panel is in ENGLISH.
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en", money: (n: number) => `${n} dram` }) };
});
const feed = vi.hoisted(() => ({ list: [] as unknown[], markRead: vi.fn(async () => {}) }));
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    list: feed.list, unreadCount: 0, loading: false, error: null, failure: null, settled: true,
    refresh: vi.fn(async () => {}), markRead: feed.markRead, markAllRead: vi.fn(), deleteOne: vi.fn(), deleteAll: vi.fn(),
  }),
}));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/repositories/ExpenseRepository", () => ({ expenseRepository: { reminders: () => Promise.resolve([]) } }));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

import Notifications from "./Notifications";

/** Short Armenian titles — the same words as the Telegram message (owner, 2026-11-09). */
const OWNER_TITLES: Record<string, string> = {
  reminder_d_minus_3: "Վճարմանը մնաց 3 օր",
  due_today: "Այսօր վճարման օրն է",
  overdue_d2: "Վճարումն ուշացել է",
  restricted_d5: "Աշխատանքը սահմանափակված է",
  suspended_d7: "Մասնաճյուղն արգելափակված է",
  restored: "Հասանելիությունը վերականգնվեց",
};
const ALL_KINDS = [...Object.keys(OWNER_TITLES), "payment_recorded", "extended"];

const notice = (kind: string, i: number) => ({
  id: `n-${kind}`,
  type: "App\\Notifications\\PlatformBillingNotice",
  read_at: i === 0 ? null : "2026-11-09T10:00:00+04:00",
  created_at: "2026-11-09T09:00:00+04:00",
  data: {
    type: `platform_billing.${kind}`, invoice_id: 31, company_id: 4, company_name: "Cyber Zone",
    period_start: "2026-10-01", period_end: "2026-10-31", amount: "12500.50", balance: "12500.50", currency: "AMD",
    commission_percent: "10.00", due_on: "2026-11-10", effective_due_on: "2026-11-10", days_overdue: 2, billing_access: "active",
    restriction_on: "2026-11-15",
  },
});

const ending = {
  id: "s-1", type: "App\\Notifications\\SessionEndingSoon", read_at: null, created_at: "2026-11-09T09:00:00+04:00",
  data: { type: "session.ending_soon", branch_id: 7, place_number: 4, minutes_left: 15, ends_at: "2026-11-09T09:15:00+04:00" },
};

const LEGACY_BILLING = {
  company_id: 4, commission_percent: 10, last_paid_at: null, next_due_at: "2026-11-10T23:59:59+04:00",
  days_until_due: 1, is_overdue: false, status: "active",
};

beforeEach(() => {
  api.calls = [];
  feed.list = ALL_KINDS.map(notice);
  feed.markRead.mockClear();
  auth.user = { id: 5, role: "company_owner", dashboard: { company_id: 4 } };
});
afterEach(cleanup);

describe("payment notices", () => {
  test("every stage is rendered in Armenian, the owner's titles verbatim, with the panel in English", async () => {
    api.handler = (p) => (p === "/company/4/billing" ? Promise.resolve({ ...LEGACY_BILLING, outstanding_amount: "12500.50" }) : Promise.reject(new Error(p)));
    render(<Notifications />);
    for (const [kind, title] of Object.entries(OWNER_TITLES)) {
      const card = await screen.findByText(title);
      expect(card.closest("[data-notice-kind]")!.getAttribute("data-notice-kind")).toBe(kind);
    }
    expect(screen.getByText(TRANSLATIONS["platformBilling.notice.payment_recorded"].am)).toBeTruthy();
    expect(screen.getByText(TRANSLATIONS["platformBilling.notice.extended"].am)).toBeTruthy();
    // One plain Armenian sentence: what happened, what comes next (the restriction date).
    const overdue = document.querySelector('[data-notice-kind="overdue_d2"]')!;
    expect(overdue.querySelector(".billing-notice__body")!.textContent).toBe("Վճարումը չի ստացվել։ 15.11.2026-ից նոր սեսիաները կսահմանափակվեն։");
    // The figures stand on their own: owed, due date, month.
    const facts = Array.from(overdue.querySelectorAll(".billing-notice__fact")).map((f) => f.textContent);
    expect(facts).toEqual([
      `Պարտք${moneyDisplay.format(12500.5, "AMD", "am", centsWhenFractional(12500.5))}`,
      "Ժամկետ10.11.2026",
      "Ամիս01.10.2026 – 31.10.2026",
    ]);
    // Restriction says what is limited and that running seats carry on.
    expect(document.querySelector('[data-notice-kind="restricted_d5"] .billing-notice__body')!.textContent).toBe(TRANSLATIONS["platformBilling.noticeSay.restricted_d5"].am);
    // …and no English title leaked in.
    expect(screen.queryByText(TRANSLATIONS["platformBilling.notice.overdue_d2"].en)).toBeNull();
  });

  test("two tabs: seats and Billing, each with a red count of its unread rows", async () => {
    feed.list = [ending, notice("due_today", 0), notice("overdue_d2", 0), { ...notice("restored", 1), id: "n-read" }];
    api.handler = (p) => (p === "/company/4/billing" ? Promise.resolve({ ...LEGACY_BILLING, outstanding_amount: "0.00" }) : Promise.reject(new Error(p)));
    render(<Notifications />);
    const seatsTab = await screen.findByRole("tab", { name: /Active Places/ });
    const billingTab = screen.getByRole("tab", { name: /Billing/ });
    // One unread seat row, two unread payment notices (the read one is not counted).
    expect(seatsTab.querySelector(".cp-subtab__badge")!.textContent).toBe("1");
    expect(billingTab.querySelector(".cp-subtab__badge")!.textContent).toBe("2");
    // The seats tab shows the seat row and no payment notice…
    expect(seatsTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Seat №4/)).toBeTruthy();
    expect(screen.queryByText(OWNER_TITLES.due_today)).toBeNull();
    // …Billing shows the notices and no seat row, never under a class name.
    fireEvent.click(billingTab);
    expect(await screen.findByText(OWNER_TITLES.due_today)).toBeTruthy();
    expect(screen.queryByText(/Seat №4/)).toBeNull();
    expect(screen.queryByText("PlatformBillingNotice")).toBeNull();
  });

  test("a tab with nothing new shows no circle; it opens on Billing when only Billing has news", async () => {
    feed.list = [{ ...ending, read_at: "2026-11-09T10:00:00+04:00" }, notice("due_today", 0)];
    api.handler = (p) => (p === "/company/4/billing" ? Promise.resolve({ ...LEGACY_BILLING, outstanding_amount: "0.00" }) : Promise.reject(new Error(p)));
    render(<Notifications />);
    const billingTab = await screen.findByRole("tab", { name: /Billing/ });
    await waitFor(() => expect(billingTab.getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByRole("tab", { name: /Active Places/ }).querySelector(".cp-subtab__badge")).toBeNull();
    expect(await screen.findByText(OWNER_TITLES.due_today)).toBeTruthy();
  });

  test("a new backend: the client-side reminder steps aside for the server's rows", async () => {
    feed.list = [];
    api.handler = (p) => (p === "/company/4/billing" ? Promise.resolve({ ...LEGACY_BILLING, outstanding_amount: "12500.50" }) : Promise.reject(new Error(p)));
    render(<Notifications />);
    await waitFor(() => expect(api.calls).toContain("/company/4/billing"));
    fireEvent.click(screen.getByRole("tab", { name: /Billing/ }));
    await screen.findByText(TRANSLATIONS["notifications.state.billingEmptyDescription"].en);
    expect(screen.queryByText(/you must pay Cyber Place/i)).toBeNull();
  });

  test("an older backend still gets the client-side reminder", async () => {
    feed.list = [];
    api.handler = (p) => (p === "/company/4/billing" ? Promise.resolve(LEGACY_BILLING) : Promise.reject(new Error(p)));
    render(<Notifications />);
    fireEvent.click(await screen.findByRole("tab", { name: /Billing/ }));
    expect(await screen.findByText(/you must pay Cyber Place/i)).toBeTruthy();
  });

  test("Details marks it read and opens that invoice", async () => {
    feed.list = [notice("overdue_d2", 0)];
    api.handler = (p) => {
      if (p === "/company/4/billing") return Promise.resolve({ ...LEGACY_BILLING, outstanding_amount: "12500.50" });
      if (p === "/company/4/platform-invoices") return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 6, total: 0 } });
      if (p === "/platform-invoices/31") {
        return Promise.resolve({ data: {
          ...notice("x", 0).data, id: 31, gross_amount: "125005.00", paid_amount: "0.00", adjustments_amount: "0.00",
          issued_at: "2026-11-01T09:00:00+04:00", paid_at: null, status: "open", billing_state: "overdue", entries: [], events: [],
        } });
      }
      return Promise.reject(new Error(p));
    };
    render(<Notifications />);
    const card = (await screen.findByText(OWNER_TITLES.overdue_d2)).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "Details" }));
    expect(feed.markRead).toHaveBeenCalledWith("n-overdue_d2");
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector('[data-invoice-id="31"]')).not.toBeNull());
    expect(api.calls).toContain("/platform-invoices/31");
  });

  test("the whole card opens the invoice, not only the Details button", async () => {
    feed.list = [notice("due_today", 0)];
    api.handler = (p) => {
      if (p === "/company/4/billing") return Promise.resolve({ ...LEGACY_BILLING, outstanding_amount: "12500.50" });
      if (p === "/company/4/platform-invoices") return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 6, total: 0 } });
      if (p === "/platform-invoices/31") return Promise.resolve({ data: { ...notice("x", 0).data, id: 31, entries: [], events: [] } });
      return Promise.reject(new Error(p));
    };
    render(<Notifications />);
    fireEvent.click(await screen.findByText(OWNER_TITLES.due_today));
    expect(feed.markRead).toHaveBeenCalledWith("n-due_today");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  test("an admin reads the notices in the panel's own language, next to the cross-company list", async () => {
    auth.user = { id: 1, role: "admin" };
    feed.list = [notice("suspended_d7", 0)];
    api.handler = (p) => (p === "/company-billing/reminders" ? Promise.resolve({ data: [] }) : Promise.reject(new Error(p)));
    render(<Notifications />);
    expect(await screen.findByText(TRANSLATIONS["platformBilling.notice.suspended_d7"].en)).toBeTruthy();
    expect(screen.queryByText(OWNER_TITLES.suspended_d7)).toBeNull();
    expect(screen.getByText(/Cyber Zone/)).toBeTruthy();
  });
});
