// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TillSalesHistory from "./TillSalesHistory";

/** Products sold on their own, in the sales history (2026-10-25). */
const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/OrderRepository", () => ({ orderRepository: { list: (...a: unknown[]) => repo.list(...a) } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k === "till.history.count" ? "{0}|{1}" : k), money: (n: number) => `${n}`, lang: "ru" }),
}));

const sale = (over: Record<string, unknown> = {}) => ({
  id: 1, branch_id: 7, subtotal: 1400, total: 1400, payment_method: "cash", status: "paid",
  created_at: "2026-10-25T10:00:00Z", cash_received: "2000.00", change: 600,
  items: [{ id: 1, product_name: "Чипсы", quantity: 2, unit_price: 700, line_total: 1400 }],
  cashier: { id: 3, name: "Иван", role: "manager" },
  ...over,
});

const mount = async (actorId: number | null = null) => {
  await act(async () => {
    render(<TillSalesHistory branchId={7} fromIso="2026-10-25T00:00:00Z" toIso="2026-10-25T23:59:59Z" actorId={actorId} refreshKey={0} />);
  });
};

describe("product sales in the history", () => {
  beforeEach(() => repo.list.mockReset());
  afterEach(cleanup);

  test("reads the page's period, up to a thousand", async () => {
    repo.list.mockResolvedValue([]);
    await mount();
    expect(repo.list).toHaveBeenCalledWith({
      branch_id: 7, date_from: "2026-10-25T00:00:00Z", date_to: "2026-10-25T23:59:59Z", limit: 1000,
    });
  });

  test("one person's sales when a person is picked", async () => {
    repo.list.mockResolvedValue([]);
    await mount(3);
    expect(repo.list.mock.calls[0][0]).toMatchObject({ cashier_user_id: 3 });
  });

  test("each sale: who sold it, what, how it was paid, received and change, the total", async () => {
    repo.list.mockResolvedValue([sale()]);
    await mount();
    const row = screen.getByTestId("till-history-row").textContent ?? "";
    expect(row).toContain("till.soldBy: Иван");
    expect(row).toContain("Чипсы × 2");
    expect(row).toContain("session.payCash");
    expect(row).toContain("till.receivedShort 2000");
    expect(row).toContain("till.changeShort 600");
    expect(row).toContain("1400");
  });

  test("a voided sale is listed, marked, and not counted", async () => {
    repo.list.mockResolvedValue([sale(), sale({ id: 2, status: "voided", total: 900 })]);
    await mount();
    expect(screen.getAllByTestId("till-history-row")).toHaveLength(2);
    expect(screen.getAllByTestId("till-history-row")[1].textContent).toContain("till.voided");
    // One paid sale, 1 400 — the voided 900 is shown, never taken.
    expect(screen.getByTestId("till-history-total").textContent).toBe("1|1400");
  });

  test("nothing sold says so", async () => {
    repo.list.mockResolvedValue([]);
    await mount();
    expect(screen.getByTestId("till-history-empty")).toBeTruthy();
  });

  test("a failed read offers Retry, which reads again", async () => {
    repo.list.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue([sale()]);
    await mount();
    const retry = screen.getAllByRole("button").find((b) => /retry|action/i.test(b.textContent ?? "")) ?? screen.getAllByRole("button")[0];
    await act(async () => { fireEvent.click(retry); });
    expect(repo.list).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("till-history-row")).toBeTruthy();
  });
});
