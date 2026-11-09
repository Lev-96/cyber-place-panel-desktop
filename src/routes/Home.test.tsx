// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The dashboard (2026-11-09): the owner's "Places" tile is gone, every tile and
 * quick link carries an icon, and the platform's bill sits on the right — the
 * owner's debt card, the admin's fleet card, nothing for a manager, and
 * nothing at all against a backend that has no platform billing.
 */

const auth = vi.hoisted(() => ({
  user: null as null | { id: number; name: string; role: string; dashboard: Record<string, unknown> },
}));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, refreshUser: async () => {} }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  // Keys print as themselves, except the templates whose placeholder carries a figure.
  useLang: () => ({ t: (k: string) => ({ "platformBilling.card.rateOfRevenue": "{0} of revenue" } as Record<string, string>)[k] ?? k, lang: "en", money: (n: number) => `${n} AMD` }),
}));
vi.mock("@/realtime/bookingScope", () => ({ resolveBookingScopeChannel: () => null }));
vi.mock("@/realtime/useBookingChanged", () => ({ useBookingChanged: () => {} }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotificationsOptional: () => null }));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

type Handler = (path: string) => Promise<unknown>;
const api = vi.hoisted(() => ({ calls: [] as string[], handler: null as null | Handler }));
vi.mock("@/api/client", () => ({
  request: (path: string) => {
    api.calls.push(path);
    return api.handler ? api.handler(path) : Promise.reject(Object.assign(new Error("404"), { status: 404 }));
  },
  apiCache: { subscribe: () => () => {} },
}));

import Home from "./Home";

const notFound = () => Promise.reject(Object.assign(new Error("Not Found"), { status: 404 }));

const OVERVIEW = {
  company_id: 4,
  currency: "AMD",
  commission_percent: "10.00",
  current_period: { start: "2026-11-01", end: "2026-11-30", gross_amount: "50000.00", commission_amount: "5000.00", is_estimate: true },
  outstanding_amount: "12500.50",
  open_invoice: {
    id: 31, company_id: 4, company_name: "Cyber Zone", period_start: "2026-10-01", period_end: "2026-10-31", currency: "AMD",
    commission_percent: "10.00", gross_amount: "125005.00", amount: "12500.50", paid_amount: "0.00", adjustments_amount: "0.00",
    balance: "12500.50", issued_at: "2026-11-01T09:00:00+04:00", due_on: "2026-11-10", effective_due_on: "2026-11-10",
    paid_at: null, status: "open", billing_state: "pending", days_overdue: 0, billing_access: "active",
  },
  next_due_on: "2026-11-10",
  billing_state: "pending",
  billing_access: "active",
  days_overdue: 0,
};

const DETAIL = {
  ...OVERVIEW.open_invoice,
  sessions_amount: "100000.00", pos_amount: "20005.00", tournaments_amount: "5000.00",
  breakdown: [{ branch_id: 5, address: "Abovyan 5", sessions_amount: "100000.00", pos_amount: "20005.00", tournaments_amount: "5000.00", gross_amount: "125005.00" }],
  entries: [],
  events: [{ id: 1, kind: "issued", due_on: null, created_at: "2026-11-01T09:00:00+04:00", actor_name: null }],
};

const mount = (role: string, dashboard: Record<string, unknown> = {}) => {
  auth.user = { id: 1, name: "Giorgi", role, dashboard };
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  api.calls = [];
  api.handler = null;
});
afterEach(cleanup);

describe("the owner's tiles", () => {
  test("no Places tile, the other three are there", () => {
    mount("company_owner", { company_id: 4, active_branches: 2, total_bookings_today: 13, upcoming_bookings: 1, all_places: 10 });
    expect(screen.queryByText("home.allPlaces")).toBeNull();
    expect(screen.queryByText("home.places")).toBeNull();
    expect(screen.queryByText("10")).toBeNull();
    const tiles = document.querySelectorAll(".stat-tile");
    expect(tiles).toHaveLength(3);
    expect(screen.getByText("home.activeBranches")).toBeTruthy();
    expect(screen.getByText("home.todaysBookings")).toBeTruthy();
    expect(screen.getByText("home.upcoming")).toBeTruthy();
  });
});

describe("icons", () => {
  test.each([
    ["admin", { total_companies: 1 }, 4],
    ["company_owner", { company_id: 4 }, 3],
    ["manager", { branch_id: 9 }, 2],
  ] as const)("every %s tile and quick link draws an icon", (role, dash, tileCount) => {
    mount(role, dash);
    const tiles = Array.from(document.querySelectorAll(".stat-tile"));
    expect(tiles).toHaveLength(tileCount);
    for (const tile of tiles) {
      const icon = tile.querySelector("svg[data-nav-icon]");
      expect(icon, tile.textContent ?? "").not.toBeNull();
      expect(icon!.children.length).toBeGreaterThan(0);
    }
    // The owner's dashboard has no shortcut cards any more (2026-11-09): the bill takes their place.
    if (role === "company_owner") {
      expect(document.querySelector(".home-links")).toBeNull();
      return;
    }
    const links = within(document.querySelector(".home-links") as HTMLElement).getAllByRole("link");
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) {
      const icon = link.querySelector("svg[data-nav-icon]");
      expect(icon, link.getAttribute("href") ?? "").not.toBeNull();
      expect(icon!.children.length).toBeGreaterThan(0);
      // Hidden from the link's accessible name: the title names it.
      expect(icon!.getAttribute("aria-hidden")).toBe("true");
    }
  });

  test("Upcoming draws the calendar-clock", () => {
    mount("company_owner", { company_id: 4 });
    const tile = screen.getByText("home.upcoming").closest(".stat-tile")!;
    expect(tile.querySelector("svg")!.getAttribute("data-nav-icon")).toBe("home.upcoming");
  });

  test("quick links carry no inline layout styles any more", () => {
    mount("admin");
    for (const link of document.querySelectorAll(".home-link")) {
      expect(link.getAttribute("style")).toBeNull();
    }
  });
});

describe("the platform debt card", () => {
  test("an owner sees it under the tiles, as wide as they are, with the server's figures", async () => {
    api.handler = (p) => (p === "/company/4/platform-billing" ? Promise.resolve(OVERVIEW) : notFound());
    mount("company_owner", { company_id: 4 });
    const card = await screen.findByTestId("platform-debt-card");
    // In the main column right after the tile grid (which fills the row), no side column.
    expect(card.closest(".home-main")).not.toBeNull();
    expect(card.previousElementSibling?.className).toContain("stat-grid--fill");
    expect(document.querySelector(".home-aside")).toBeNull();
    // Where it stands, in one sentence (due in the future → "pay by <date>").
    expect(card.querySelector(".platform-debt__say")!.textContent).toBe("platformBilling.say.payBy");
    expect(within(card).getByText("platformBilling.debtTitle")).toBeTruthy();
    // Printed as the server sent it — 12500.50 owed, 5000 estimate this month.
    expect(card.querySelector(".platform-debt__total-value")!.textContent).toBe("12500.5 AMD");
    expect(within(card).getByText("5000 AMD")).toBeTruthy();
    expect(within(card).getByText("platformBilling.estimate")).toBeTruthy();
    expect(within(card).getByText("10.11.2026")).toBeTruthy();
    expect(within(card).getByText("10% of revenue")).toBeTruthy();
    expect(card.querySelector('[data-billing-access="active"]')).not.toBeNull();
  });

  test("this month's estimate names the company's current rate; the invoice keeps its own in Details", async () => {
    // The rate changed after the invoice was issued (10 % → 25 %).
    api.handler = (p) => {
      if (p === "/company/4/platform-billing") return Promise.resolve({ ...OVERVIEW, commission_percent: "25.00" });
      if (p === "/company/4/platform-invoices") return Promise.resolve({ data: [OVERVIEW.open_invoice], meta: { current_page: 1, last_page: 1, per_page: 6, total: 1 } });
      if (p === "/platform-invoices/31") return Promise.resolve({ data: DETAIL });
      return notFound();
    };
    mount("company_owner", { company_id: 4 });
    const card = await screen.findByTestId("platform-debt-card");
    expect(within(card).getByText("25% of revenue")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "platformBilling.details" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".billing-glance__calc")).not.toBeNull());
    // The issued invoice is calculated at ITS 10 %.
    expect(dialog.querySelector(".billing-glance__calc")!.textContent).toBe("platformBilling.drawer.calc");
    expect(dialog.querySelector('[data-invoice-id="31"]')).not.toBeNull();
  });

  test("a manager gets no card and asks nothing", async () => {
    mount("manager", { branch_id: 9 });
    await waitFor(() => expect(document.querySelector(".stat-tile")).not.toBeNull());
    expect(screen.queryByTestId("platform-debt-card")).toBeNull();
    expect(document.querySelector(".home-aside")).toBeNull();
    expect(api.calls.filter((p) => p.includes("platform"))).toEqual([]);
  });

  test("a backend without the endpoint: no card, no error", async () => {
    api.handler = () => notFound();
    mount("company_owner", { company_id: 4 });
    await waitFor(() => expect(api.calls).toContain("/company/4/platform-billing"));
    await waitFor(() => expect(document.querySelector(".skeleton, .cp-skeleton")).toBeNull());
    expect(screen.queryByTestId("platform-debt-card")).toBeNull();
    expect(screen.queryByText("platformBilling.state.errorTitle")).toBeNull();
  });

  test("Details opens the invoice with its base, history and percent", async () => {
    api.handler = (p) => {
      if (p === "/company/4/platform-billing") return Promise.resolve(OVERVIEW);
      if (p === "/company/4/platform-invoices") return Promise.resolve({ data: [OVERVIEW.open_invoice], meta: { current_page: 1, last_page: 1, per_page: 6, total: 1 } });
      if (p === "/platform-invoices/31") return Promise.resolve({ data: DETAIL });
      return notFound();
    };
    mount("company_owner", { company_id: 4 });
    fireEvent.click(await screen.findByRole("button", { name: "platformBilling.details" }));

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Abovyan 5");
    expect(api.calls).toContain("/platform-invoices/31");
    expect(dialog.querySelector('[data-invoice-id="31"]')).not.toBeNull();
    expect(within(dialog).getByText("platformBilling.included")).toBeTruthy();
    expect(within(dialog).getByText("platformBilling.excluded")).toBeTruthy();
    expect(within(dialog).getByText("platformBilling.event.issued")).toBeTruthy();
    expect(within(dialog).getAllByText("01.10.2026 – 31.10.2026").length).toBeGreaterThan(0);
  });
});

describe("the details panel", () => {
  test("slides in on the right with the answer first; the rest is folded; Escape closes it", async () => {
    api.handler = (p) => {
      if (p === "/company/4/platform-billing") return Promise.resolve(OVERVIEW);
      if (p === "/company/4/platform-invoices") return Promise.resolve({ data: [OVERVIEW.open_invoice], meta: { current_page: 1, last_page: 1, per_page: 6, total: 1 } });
      if (p === "/platform-invoices/31") return Promise.resolve({ data: DETAIL });
      return notFound();
    };
    mount("company_owner", { company_id: 4 });
    fireEvent.click(await screen.findByRole("button", { name: "platformBilling.details" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest(".cp-drawer")).not.toBeNull();
    // At a glance: where it stands, what is left, the three facts, how the figure came about.
    await waitFor(() => expect(dialog.querySelector(".billing-glance")).not.toBeNull());
    expect(dialog.querySelector(".billing-glance__say")!.textContent).toBe("platformBilling.say.payBy");
    expect(dialog.querySelector(".billing-glance__amount")!.textContent).toBe("12500.5 AMD");
    expect(dialog.querySelectorAll(".billing-glance__facts > div")).toHaveLength(3);
    expect(dialog.querySelector(".billing-glance__calc")).not.toBeNull();
    // The long part is there but folded: nothing to scroll past to get the answer.
    const folds = Array.from(dialog.querySelectorAll("details.billing-drawer__fold"));
    expect(folds.length).toBeGreaterThan(0);
    for (const fold of folds) expect((fold as HTMLDetailsElement).open).toBe(false);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("the admin's fleet card", () => {
  test("shows the server's totals and links to Club payments", async () => {
    api.handler = (p) =>
      p === "/platform-invoices"
        ? Promise.resolve({
          data: [], meta: { current_page: 1, last_page: 3, per_page: 1, total: 3 },
          totals: { count: 3, amount: "120000.00", balance: "90000.00" },
        })
        : notFound();
    mount("admin");
    const card = await screen.findByTestId("platform-fleet-card");
    expect(within(card).getByText("90000 AMD")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "platformBilling.fleet.openPage" }).getAttribute("href")).toBe("/platform-billing");
  });

  test("hidden against a backend without the endpoint", async () => {
    api.handler = () => notFound();
    mount("admin");
    await waitFor(() => expect(api.calls).toContain("/platform-invoices"));
    await waitFor(() => expect(document.querySelector(".home-aside")!.children.length).toBe(0));
  });
});
