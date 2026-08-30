// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import AddSessionItemDialog from "./AddSessionItemDialog";

/**
 * The dialog is a basket, and the whole point is what it does NOT do.
 *
 * Choosing a product and moving its count used to write to the session on every
 * press. That left a trail of rows behind a decision still being made, and gave
 * the cashier nothing to cancel — the changes were already on the bill. Now
 * every control is local and exactly one request leaves, when they confirm.
 *
 * So the assertions here are mostly about silence: after adding three products
 * and pushing counts around, the repository must not have been called once.
 */

const repo = vi.hoisted(() => ({
  addItems: vi.fn(),
  listProducts: vi.fn(),
  removeItem: vi.fn(),
}));
/** Stands in for the Products screen's own form. */
const form = vi.hoisted(() => ({ saved: null as ((p: unknown) => void) | null }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    addItems: (...a: unknown[]) => repo.addItems(...a),
    // Present so a stray call would be visible as a failure, not a crash.
    addItem: vi.fn(),
    setItemQty: vi.fn(),
    removeItem: (...a: unknown[]) => repo.removeItem(...a),
  },
}));
vi.mock("@/components/products/ProductForm", () => ({
  default: ({ onSaved }: { onSaved: (p: unknown) => void }) => {
    form.saved = onSaved;
    return <div data-testid="product-form" />;
  },
}));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listByBranch: (...a: unknown[]) => repo.listProducts(...a) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    // Keys echo back, except the one whose real translation carries a
    // placeholder — the reason has to survive `fmt` for the assertion below to
    // mean anything.
    t: (k: string) => (k === "session.failReason" ? "session.failReason: {0}" : k),
    money: (n: number) => String(n),
    lang: "en",
  }),
}));
const toasts = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toasts.message(...a) } }));

const session = { id: 42, pc_id: 7, pc_label: "№1", items: [] } as unknown as ISessionApi;

const products = [
  { id: 10, branch_id: 1, name: "Lays", category: "Snacks", price: 400, is_active: true },
  { id: 15, branch_id: 1, name: "Coffee", category: "Drinks", price: 600, is_active: true },
];

const mount = async (over: Partial<React.ComponentProps<typeof AddSessionItemDialog>> = {}) => {
  const onAdded = vi.fn();
  const onClose = vi.fn();
  await act(async () => {
    render(
      <AddSessionItemDialog
        branchId={1}
        session={session}
        onAdded={onAdded}
        onClose={onClose}
        {...over}
      />,
    );
  });
  return { onAdded, onClose };
};

/** The catalogue's plus button for a product, by its accessible name. */
const plusFor = (name: string): HTMLButtonElement =>
  screen.getByLabelText(`action.add: ${name}`) as HTMLButtonElement;

const confirmButton = () =>
  screen.getAllByRole("button").find((b) =>
    b.textContent === "session.cartConfirmOne" ||
    b.textContent === "session.cartConfirmMany" ||
    b.textContent === "session.adding") as HTMLButtonElement;

afterEach(() => cleanup());
beforeEach(() => {
  repo.addItems.mockReset();
  repo.addItems.mockResolvedValue({ ...session, items: [] });
  repo.listProducts.mockReset();
  repo.listProducts.mockResolvedValue(products);
  toasts.message.mockReset();
});

describe("AddSessionItemDialog — the basket", () => {
  test("choosing products and moving counts sends nothing", async () => {
    await mount();

    fireEvent.click(plusFor("Lays"));
    fireEvent.click(plusFor("Lays"));
    fireEvent.click(plusFor("Coffee"));
    // Move the counts around: plus, minus, and a line taken back out.
    const minus = screen.getAllByLabelText("session.decrease")[0];
    fireEvent.click(minus);

    expect(repo.addItems).not.toHaveBeenCalled();
  });

  test("confirming sends one request carrying the whole basket", async () => {
    const { onAdded, onClose } = await mount();

    fireEvent.click(plusFor("Lays"));
    fireEvent.click(plusFor("Lays"));
    fireEvent.click(plusFor("Coffee"));

    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(repo.addItems).toHaveBeenCalledTimes(1);
    expect(repo.addItems).toHaveBeenCalledWith(42, [
      { product_id: 10, qty: 2 },
      { product_id: 15, qty: 1 },
    ]);
    // Success: the session is refreshed and the dialog is done.
    expect(onAdded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(toasts.message).toHaveBeenCalledWith("success", expect.stringContaining("session.addedMany"));
  });

  test("a single line gets the singular wording", async () => {
    await mount();
    fireEvent.click(plusFor("Lays"));

    expect(confirmButton().textContent).toBe("session.cartConfirmOne");

    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(toasts.message).toHaveBeenCalledWith("success", expect.stringContaining("session.addedOne"));
  });

  test("a rejected basket keeps the selection and shows the server's reason", async () => {
    repo.addItems.mockRejectedValue(new Error("This session is no longer active"));
    const { onAdded, onClose } = await mount();

    fireEvent.click(plusFor("Lays"));
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    // The cashier has to be able to fix it and try again, so nothing is
    // cleared and the dialog stays open.
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
    expect(confirmButton()).toBeTruthy();
    expect(toasts.message).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("This session is no longer active"),
    );
  });

  test("the confirm button is dead until something is selected", async () => {
    await mount();

    expect(confirmButton().disabled).toBe(true);

    fireEvent.click(plusFor("Coffee"));
    expect(confirmButton().disabled).toBe(false);
  });

  test("a second press cannot send the basket twice", async () => {
    // A request that never settles, so the button stays in its sending state.
    repo.addItems.mockReturnValue(new Promise(() => {}));
    await mount();

    fireEvent.click(plusFor("Lays"));
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(confirmButton().textContent).toBe("session.adding");
    expect(confirmButton().disabled).toBe(true);

    fireEvent.click(confirmButton());
    expect(repo.addItems).toHaveBeenCalledTimes(1);
  });
});

/**
 * The two things this dialog gained: a branch with an empty catalogue can start
 * one from here, and a line already on the bill can come off it.
 */
describe("creating a product from the basket", () => {
  test("the new product joins the catalogue AND the basket, in one action", async () => {
    repo.listProducts.mockResolvedValue([]);
    await mount();

    // Nothing to sell yet — this is the case the button exists for.
    expect(screen.getByText("session.noProducts")).toBeTruthy();

    fireEvent.click(screen.getByText("session.createProduct"));
    expect(screen.getByTestId("product-form")).toBeTruthy();

    await act(async () => {
      form.saved?.({ id: 77, branch_id: 1, name: "Espresso", category: "Drinks", price: 500, is_active: true });
    });

    // Two places, which is the whole point: the catalogue row (with its own
    // plus) and the basket line beneath it.
    expect(plusFor("Espresso")).toBeTruthy();
    expect(screen.getAllByText("Espresso")).toHaveLength(2);
    expect(confirmButton().disabled).toBe(false);
    // Still nothing written to the session: the basket is a decision.
    expect(repo.addItems).not.toHaveBeenCalled();
  });

  test("confirming afterwards sends the created product by id, not as a loose line", async () => {
    repo.listProducts.mockResolvedValue([]);
    repo.addItems.mockResolvedValue({});
    await mount();

    fireEvent.click(screen.getByText("session.createProduct"));
    await act(async () => {
      form.saved?.({ id: 77, branch_id: 1, name: "Espresso", category: "Drinks", price: 500, is_active: true });
    });
    await act(async () => { fireEvent.click(confirmButton()!); });

    expect(repo.addItems).toHaveBeenCalledWith(42, [{ product_id: 77, qty: 1 }]);
  });
});

describe("taking a line off the bill", () => {
  const withBill = { ...session, items: [{ id: 5, name: "Cola", qty: 2, price: 300 }] } as unknown as ISessionApi;

  test("it goes to the server at once and says so in red", async () => {
    repo.listProducts.mockResolvedValue(products);
    repo.removeItem.mockResolvedValue({});
    const { onAdded } = await mount({ session: withBill });

    await act(async () => { fireEvent.click(screen.getByLabelText("action.delete: Cola")); });

    expect(repo.removeItem).toHaveBeenCalledWith(42, 5);
    expect(toasts.message).toHaveBeenCalledWith("error", expect.stringContaining("session.removedOne"));
    // The screen behind is told, so the bill it shows is the bill there is.
    expect(onAdded).toHaveBeenCalled();
    // And the line is off THIS dialog too: the parent's refresh does not reach
    // an open modal, and a line that stays looks like a removal that failed.
    expect(screen.queryByLabelText("action.delete: Cola")).toBeNull();
  });

  test("a refusal does not claim the line was removed", async () => {
    repo.listProducts.mockResolvedValue(products);
    repo.removeItem.mockRejectedValue(new Error("session is no longer active"));
    const { onAdded } = await mount({ session: withBill });

    await act(async () => { fireEvent.click(screen.getByLabelText("action.delete: Cola")); });

    const said = toasts.message.mock.calls.map((c) => String(c[1])).join(" | ");
    expect(said).toContain("session.removeFailed");
    expect(said).toContain("session is no longer active");
    expect(said).not.toContain("session.removedOne");
    expect(onAdded).not.toHaveBeenCalled();
  });
});
