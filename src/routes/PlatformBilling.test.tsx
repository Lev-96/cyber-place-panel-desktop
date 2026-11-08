// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * "Club payments" (admin, 2026-11-09): every write is checked, then confirmed
 * in the app's own dialog, then sent with exactly the typed values; a refusal
 * from the server is shown in the dialog, and nothing is sent without a Yes.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => `${n} AMD` }),
}));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const confirmFn = vi.hoisted(() => ({ fn: vi.fn(async (_m: string, _o?: unknown) => true) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => confirmFn.fn }));

type Call = { path: string; method: string; body?: unknown; params?: Record<string, unknown> };
const api = vi.hoisted(() => ({
  calls: [] as Call[],
  handler: (_c: Call): Promise<unknown> => Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; body?: unknown; params?: Record<string, unknown> } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body, params: opts.params };
    api.calls.push(call);
    return api.handler(call);
  },
  apiCache: { subscribe: () => () => {} },
}));

import PlatformBilling from "./PlatformBilling";

const ROW = {
  id: 31, company_id: 4, company_name: "Cyber Zone", period_start: "2026-10-01", period_end: "2026-10-31", currency: "AMD",
  commission_percent: "10.00", gross_amount: "125005.00", amount: "12500.50", paid_amount: "0.00", adjustments_amount: "0.00",
  balance: "12500.50", issued_at: "2026-11-01T09:00:00+04:00", due_on: "2026-11-10", effective_due_on: "2026-11-10",
  paid_at: null, status: "open", billing_state: "overdue", days_overdue: 6, billing_access: "restricted",
  branches: [{ id: 5, address: "Abovyan 5" }],
};
const DETAIL = { ...ROW, entries: [], events: [], breakdown: [] };

const ok = (c: Call): Promise<unknown> => {
  if (c.path === "/platform-invoices" && c.method === "GET") {
    return Promise.resolve({ data: [ROW], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } });
  }
  if (c.path === "/platform-invoices/31" && c.method === "GET") return Promise.resolve({ data: DETAIL });
  if (c.path === "/company") return Promise.resolve({ data: [{ id: 4, name: "Cyber Zone" }] });
  if (c.method === "POST") return Promise.resolve({ data: DETAIL, replayed: false });
  return Promise.reject(Object.assign(new Error("Not Found"), { status: 404 }));
};

const posts = () => api.calls.filter((c) => c.method === "POST");

const openInvoice = async () => {
  render(<PlatformBilling />);
  fireEvent.click(await screen.findByRole("button", { name: /Cyber Zone/ }));
  await screen.findByText("platformBilling.chargesTitle");
};

const openAction = async (label: string) => {
  fireEvent.click(screen.getByRole("button", { name: label }));
  return screen.findByRole("dialog");
};

const submit = (dialog: HTMLElement, label: string) =>
  fireEvent.click(within(dialog).getAllByRole("button", { name: label }).find((b) => b.getAttribute("type") === "submit")!);

beforeEach(() => {
  api.calls = [];
  api.handler = ok;
  confirmFn.fn.mockReset();
  confirmFn.fn.mockResolvedValue(true);
});
afterEach(cleanup);

describe("the list", () => {
  test("asks for unpaid invoices first and shows the server's figures", async () => {
    render(<PlatformBilling />);
    const row = await screen.findByRole("button", { name: /Cyber Zone/ });
    expect(api.calls.find((c) => c.path === "/platform-invoices")!.params).toMatchObject({ state: "open" });
    expect(within(row).getByText("Abovyan 5", { exact: false })).toBeTruthy();
    expect(within(row).getByText("6")).toBeTruthy();
    expect(row.querySelector('[data-billing-access="restricted"]')).not.toBeNull();
  });

  test("a backend without the endpoint says so instead of failing", async () => {
    api.handler = (c) => (c.path === "/company" ? Promise.resolve({ data: [] }) : Promise.reject(Object.assign(new Error("Not Found"), { status: 404 })));
    render(<PlatformBilling />);
    expect(await screen.findByText("platformBilling.admin.missing")).toBeTruthy();
  });
});

describe("record a payment", () => {
  test("confirmed, then sent with exactly what was typed; the invoice is read again", async () => {
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.recordPayment");
    fireEvent.change(within(dialog).getByLabelText(/platformBilling.admin.amount/), { target: { value: "1500" } });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "cash" } });
    fireEvent.change(within(dialog).getByLabelText("platformBilling.admin.reference"), { target: { value: "R-7" } });
    const readsBefore = api.calls.filter((c) => c.path === "/platform-invoices/31").length;
    submit(dialog, "platformBilling.admin.recordPayment");

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(confirmFn.fn).toHaveBeenCalledTimes(1);
    expect(confirmFn.fn.mock.calls[0][0]).toBe("platformBilling.admin.confirmPayment");
    expect(posts()[0]).toMatchObject({
      path: "/platform-invoices/31/payments",
      body: { amount: "1500", method: "cash", reference: "R-7" },
    });
    await screen.findByText("platformBilling.admin.saved");
    expect(api.calls.filter((c) => c.path === "/platform-invoices/31").length).toBeGreaterThan(readsBefore);
  });

  test("No in the confirm sends nothing", async () => {
    confirmFn.fn.mockResolvedValue(false);
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.recordPayment");
    fireEvent.change(within(dialog).getByLabelText(/platformBilling.admin.amount/), { target: { value: "1500" } });
    submit(dialog, "platformBilling.admin.recordPayment");
    await waitFor(() => expect(confirmFn.fn).toHaveBeenCalledTimes(1));
    expect(posts()).toEqual([]);
  });

  test("an invalid amount never reaches the confirm", async () => {
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.recordPayment");
    fireEvent.change(within(dialog).getByLabelText(/platformBilling.admin.amount/), { target: { value: "0" } });
    submit(dialog, "platformBilling.admin.recordPayment");
    expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "platformBilling.admin.invalidAmount");
    expect(confirmFn.fn).not.toHaveBeenCalled();
    expect(posts()).toEqual([]);
  });
});

describe("adjustment", () => {
  test("a reason is required before anything is asked or sent", async () => {
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.adjust");
    fireEvent.change(within(dialog).getByLabelText(/platformBilling.admin.signedAmount/), { target: { value: "-2000" } });
    submit(dialog, "platformBilling.admin.adjust");
    expect((await within(dialog).findByRole("alert")).textContent).toBe("platformBilling.admin.reasonRequired");
    expect(confirmFn.fn).not.toHaveBeenCalled();
    expect(posts()).toEqual([]);
  });

  test("with a reason: confirmed and sent signed", async () => {
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.adjust");
    fireEvent.change(within(dialog).getByLabelText(/platformBilling.admin.signedAmount/), { target: { value: "-2000" } });
    fireEvent.change(within(dialog).getByLabelText("platformBilling.admin.reason"), { target: { value: "outage refund" } });
    submit(dialog, "platformBilling.admin.adjust");
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(confirmFn.fn.mock.calls[0][0]).toBe("platformBilling.admin.confirmAdjust");
    expect(posts()[0]).toMatchObject({ path: "/platform-invoices/31/adjustments", body: { amount: "-2000", reason: "outage refund" } });
  });
});

describe("extend the due date", () => {
  test("a past date is refused before the confirm", async () => {
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.extend");
    fireEvent.change(within(dialog).getByLabelText("platformBilling.admin.newDueDate"), { target: { value: "01.01.20" } });
    fireEvent.change(within(dialog).getByLabelText("platformBilling.admin.reason"), { target: { value: "x" } });
    submit(dialog, "platformBilling.admin.extend");
    expect((await within(dialog).findByRole("alert")).textContent).toBe("platformBilling.admin.dateAfterToday");
    expect(posts()).toEqual([]);
  });

  test("a later date and a reason are sent; the server's refusal is shown in the dialog", async () => {
    api.handler = (c) =>
      c.method === "POST"
        ? Promise.reject(Object.assign(new Error("The new due on must be a date after today."), {
          status: 422, body: { message: "The new due on must be a date after today." },
        }))
        : ok(c);
    await openInvoice();
    const dialog = await openAction("platformBilling.admin.extend");
    fireEvent.change(within(dialog).getByLabelText("platformBilling.admin.newDueDate"), { target: { value: "20.12.99" } });
    fireEvent.change(within(dialog).getByLabelText("platformBilling.admin.reason"), { target: { value: "agreed by phone" } });
    submit(dialog, "platformBilling.admin.extend");
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toMatchObject({ path: "/platform-invoices/31/extend", body: { new_due_on: "2099-12-20", reason: "agreed by phone" } });
    expect((await within(dialog).findByRole("alert")).textContent).toBe("The new due on must be a date after today.");
    // Still open: the admin can correct it.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
