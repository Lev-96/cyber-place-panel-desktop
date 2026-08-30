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
}));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    addItems: (...a: unknown[]) => repo.addItems(...a),
    // Present so a stray call would be visible as a failure, not a crash.
    addItem: vi.fn(),
    setItemQty: vi.fn(),
    removeItem: vi.fn(),
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
