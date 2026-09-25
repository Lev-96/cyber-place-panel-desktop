// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import SellProductsDialog from "./SellProductsDialog";

/**
 * Selling at the till with no session (2026-09-24): the session bill's own
 * basket and quick entry, the session stop's own payment choice, and one
 * request — to the SALE endpoint, never a session's — carrying no price.
 */

const repo = vi.hoisted(() => ({
  create: vi.fn(),
  resolve: vi.fn(),
  listProducts: vi.fn(),
  sessionAddItems: vi.fn(),
  sessionResolve: vi.fn(),
}));

vi.mock("@/repositories/OrderRepository", () => ({
  orderRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    resolveItemsText: (...a: unknown[]) => repo.resolve(...a),
    list: vi.fn(),
  },
}));
// Present so a stray call into a SESSION would be visible as a failure.
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    addItems: (...a: unknown[]) => repo.sessionAddItems(...a),
    resolveItemsText: (...a: unknown[]) => repo.sessionResolve(...a),
  },
}));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listByBranch: (...a: unknown[]) => repo.listProducts(...a) },
}));
vi.mock("@/components/products/ProductForm", () => ({ default: () => null }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k === "till.sold" ? "sold: {0}" : k),
    money: (n: number) => String(n),
    lang: "en",
  }),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
const toast = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toast.message(...a) } }));

const PRODUCTS = [
  { id: 1, branch_id: 7, name: "Tea", category: "Drinks", price: 500, is_active: true },
  { id: 2, branch_id: 7, name: "Coca-Cola", category: "Drinks", price: 700, is_active: true },
  { id: 3, branch_id: 7, name: "Old snack", category: "Snacks", price: 300, is_active: false },
];

const onClose = vi.fn();
const onSold = vi.fn();

const mount = async () => {
  await act(async () => {
    render(<SellProductsDialog branchId={7} onClose={onClose} onSold={onSold} />);
  });
};
const add = async (name: string) => {
  await act(async () => { fireEvent.click(screen.getByLabelText(`action.add: ${name}`)); });
};
const sellButton = () => screen.getByText("till.sellConfirm").closest("button") as HTMLButtonElement;
const sell = async () => { await act(async () => { fireEvent.click(sellButton()); }); };
const choose = async (label: string) => {
  await act(async () => { fireEvent.click(screen.getByLabelText(label)); });
};

afterEach(() => cleanup());
beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  toast.message.mockReset();
  onClose.mockReset();
  onSold.mockReset();
  repo.listProducts.mockResolvedValue(PRODUCTS);
  repo.create.mockResolvedValue({ id: 99 });
});

describe("the basket", () => {
  test("picked products sell as one sale, paid in cash by default, with no price sent", async () => {
    await mount();
    await add("Tea");
    await add("Tea");
    await add("Coca-Cola");

    expect(screen.getByText("till.total").parentElement!.textContent).toContain("1700");
    await sell();

    expect(repo.create).toHaveBeenCalledTimes(1);
    const body = repo.create.mock.calls[0][0];
    expect(body).toMatchObject({
      branch_id: 7,
      payment_method: "cash",
      items: [{ product_id: 1, quantity: 2 }, { product_id: 2, quantity: 1 }],
    });
    // The server prices it: nothing here carries a price.
    expect(JSON.stringify(body.items)).not.toMatch(/price/);
    expect(typeof body.client_request_id).toBe("string");
    expect(body).not.toHaveProperty("payment_method_other");

    expect(toast.message).toHaveBeenCalledWith("success", "sold: Tea × 2, Coca-Cola × 1");
    expect(onSold).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Never a session.
    expect(repo.sessionAddItems).not.toHaveBeenCalled();
  });

  test("a withdrawn product is not offered", async () => {
    await mount();

    expect(screen.queryByLabelText("action.add: Old snack")).toBeNull();
  });

  test("nothing to sell, nothing to press", async () => {
    await mount();

    expect(sellButton().disabled).toBe(true);
  });
});

describe("paid the way a session is", () => {
  test("card", async () => {
    await mount();
    await add("Tea");
    await choose("session.payCard");
    await sell();

    expect(repo.create.mock.calls[0][0].payment_method).toBe("card");
  });

  test("other needs its note, and the note is sent trimmed", async () => {
    await mount();
    await add("Tea");
    await choose("session.payOther");

    await sell();
    expect(repo.create).not.toHaveBeenCalled();
    expect(screen.getByText("session.payOtherRequired")).toBeTruthy();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("session.payOtherPlaceholder"), { target: { value: "  Idram " } });
    });
    await sell();

    expect(repo.create.mock.calls[0][0]).toMatchObject({ payment_method: "other", payment_method_other: "Idram" });
  });
});

describe("one press, one sale", () => {
  test("a double click sends one request", async () => {
    let release: (v: unknown) => void = () => {};
    repo.create.mockReturnValue(new Promise((r) => { release = r; }));
    await mount();
    await add("Tea");

    await act(async () => { fireEvent.click(sellButton()); fireEvent.click(sellButton()); });
    expect(repo.create).toHaveBeenCalledTimes(1);
    await act(async () => { release({ id: 1 }); });
  });

  test("a refused sale keeps the basket, and the retry is the SAME press", async () => {
    repo.create.mockRejectedValueOnce(new Error("This product is not sold at this branch any more."));
    await mount();
    await add("Tea");

    await sell();
    expect(screen.getByText("This product is not sold at this branch any more.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("till.total").parentElement!.textContent).toContain("500");

    await sell();
    expect(repo.create).toHaveBeenCalledTimes(2);
    expect(repo.create.mock.calls[1][0].client_request_id).toBe(repo.create.mock.calls[0][0].client_request_id);
  });
});

describe("typed lines", () => {
  const RESOLVED = {
    lines: [
      { raw: "2 tea", product_id: 1, name: "Tea", price: 500, qty: 2, line_total: 1000, error: null, candidates: [] },
      { raw: "cola 3", product_id: 2, name: "Coca-Cola", price: 700, qty: 3, line_total: 2100, error: null, candidates: [] },
    ],
    items: [{ product_id: 1, qty: 2 }, { product_id: 2, qty: 3 }],
    total: 3100,
    ok: true,
  };

  const typeLines = async (text: string) => {
    await choose("session.addModeText");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("session.quickEntry"), { target: { value: text } });
      await new Promise((r) => setTimeout(r, 450));
    });
  };

  test("are read by the till's reader — for this branch, not a session — and sell as read", async () => {
    repo.resolve.mockResolvedValue(RESOLVED);
    await mount();
    await typeLines("2 tea\ncola 3");

    expect(repo.resolve).toHaveBeenCalledWith(7, "2 tea\ncola 3");
    expect(repo.sessionResolve).not.toHaveBeenCalled();
    expect(screen.getByText("till.total").parentElement!.textContent).toContain("3100");

    await sell();
    expect(repo.create.mock.calls[0][0].items).toEqual([{ product_id: 1, quantity: 2 }, { product_id: 2, quantity: 3 }]);
  });

  test("a name that fits several products holds the sale until one is picked, then sells the pick", async () => {
    const options = [
      { product_id: 2, name: "Coca-Cola", price: 700, line_total: 2100 },
      { product_id: 4, name: "Coca-Cola can", price: 900, line_total: 2700 },
    ];
    repo.resolve
      .mockResolvedValueOnce({
        lines: [{ raw: "cola 3", status: "ambiguous", product_id: null, name: null, price: null, qty: 3, line_total: null,
          error: "ambiguous", candidates: ["Coca-Cola", "Coca-Cola can"], options }],
        items: [], total: 0, ok: false,
      })
      .mockResolvedValue({
        lines: [{ raw: "cola 3", status: "matched", product_id: 4, name: "Coca-Cola can", price: 900, qty: 3, line_total: 2700,
          error: null, candidates: [], options }],
        items: [{ product_id: 4, qty: 3 }], total: 2700, ok: true,
      });
    await mount();
    await typeLines("cola 3");

    expect(sellButton().disabled).toBe(true);
    const can = [...document.querySelectorAll(".quick-pick input[type=radio]")]
      .find((r) => r.closest("label")?.textContent?.includes("Coca-Cola can")) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(can);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(repo.resolve).toHaveBeenLastCalledWith(7, "cola 3", [{ line: 0, raw: "cola 3", product_id: 4 }]);
    expect(sellButton().disabled).toBe(false);
    await sell();
    expect(repo.create.mock.calls[0][0].items).toEqual([{ product_id: 4, quantity: 3 }]);
  });

  test("a line the reader could not place holds the sale", async () => {
    repo.resolve.mockResolvedValue({
      lines: [{ raw: "2 pizza", product_id: null, name: null, price: null, qty: 2, line_total: null, error: "unknown", candidates: [] }],
      items: [],
      total: 0,
      ok: false,
    });
    await mount();
    await typeLines("2 pizza");

    expect(sellButton().disabled).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
