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
  resolveItemsText: vi.fn(),
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
    resolveItemsText: (...a: unknown[]) => repo.resolveItemsText(...a),
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
/**
 * Keys whose real translation carries a `{0}`. They echo back WITH it, so the
 * value `fmt` substitutes — a server sentence, a product name — survives into
 * the DOM and an assertion about it means something.
 */
const PLACEHOLDER_KEYS = new Set([
  "session.failReason",
  "session.quickEntryLine",
  "session.quickEntryCandidates",
  "session.quickEntryPick",
]);

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    // Keys echo back, except the one whose real translation carries a
    // placeholder — the reason has to survive `fmt` for the assertion below to
    // mean anything.
    t: (k: string) => (PLACEHOLDER_KEYS.has(k) ? `${k}: {0}` : k),
    money: (n: number) => String(n),
    lang: "en",
  }),
}));
/**
 * Who is looking at the dialog.
 *
 * Everything below except the two role tests is written from an owner's seat,
 * which is what it was before the role gate existed — so the existing
 * assertions still describe the same screen.
 */
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, role: auth.role } }),
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
  auth.role = "company_owner";
  repo.addItems.mockReset();
  repo.addItems.mockResolvedValue({ ...session, items: [] });
  repo.listProducts.mockReset();
  repo.listProducts.mockResolvedValue(products);
  repo.resolveItemsText.mockReset();
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

  test("a manager is not offered the catalogue form at all", async () => {
    // The backend has always refused a manager here (`products.manage` → 403).
    // The button was drawn anyway, so the one role standing at the counter
    // pressed it mid-sale and got a permission error. They sell from the list.
    auth.role = "manager";
    repo.listProducts.mockResolvedValue(products);
    await mount();

    expect(screen.queryByText("session.createProduct")).toBeNull();
    expect(screen.queryByText("session.createProductHint")).toBeNull();
    // The catalogue itself is untouched: selling is exactly what they may do.
    expect(plusFor("Lays")).toBeTruthy();
  });

  test("an owner still gets it", async () => {
    auth.role = "company_owner";
    repo.listProducts.mockResolvedValue(products);
    await mount();

    expect(screen.getByText("session.createProduct")).toBeTruthy();
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


describe("chips belong to a poker table", () => {
  const withChips = [
    ...products,
    { id: 20, branch_id: 1, name: "Chips 100", category: "chips", price: 100, is_active: true },
  ];

  beforeEach(() => {
    repo.listProducts.mockReset();
    repo.listProducts.mockResolvedValue(withChips);
  });

  /**
   * The catalogue is one list per branch, so a venue that sells chips offers
   * them to every screen that reads it. This is where a PlayStation stops
   * seeing them.
   */
  test("a seat that is not a poker table is not offered chips", async () => {
    await mount({ session: { ...session, supports_chips: false } as unknown as ISessionApi });

    expect(screen.getByText("Lays")).toBeTruthy();
    expect(screen.queryByText("Chips 100")).toBeNull();
  });

  test("a poker table is", async () => {
    await mount({ session: { ...session, supports_chips: true } as unknown as ISessionApi });

    expect(screen.getByText("Chips 100")).toBeTruthy();
    // …and it still sells everything else, because a poker table has a bar too.
    expect(screen.getByText("Lays")).toBeTruthy();
  });

  /**
   * A payload from a backend that predates the field reads as "not a poker
   * table", which is the safe direction: a missing answer must not offer an
   * operation the server would refuse.
   */
  test("a seat that does not say is not offered chips", async () => {
    await mount({ session: { ...session } as unknown as ISessionApi });

    expect(screen.queryByText("Chips 100")).toBeNull();
  });

  /** Searching cannot reach past the rule. */
  test("chips stay hidden even when searched for by name", async () => {
    await mount({ session: { ...session, supports_chips: false } as unknown as ISessionApi });

    const search = screen.getByRole("textbox");
    await act(async () => { fireEvent.change(search, { target: { value: "chips" } }); });

    expect(screen.queryByText("Chips 100")).toBeNull();
  });
});


/**
 * The second way in: type the order instead of finding each product.
 *
 * What is pinned here is mostly what the dialog must NOT do — open on the new
 * mode, send anything while the cashier is still typing, or offer a confirm
 * for a batch the server said it could not read. The matching itself is the
 * server's and is tested there; this side must only be honest about the answer.
 */
describe("AddSessionItemDialog — typing the order", () => {
  const RESOLVED_OK = {
    lines: [
      { raw: "20 lays", product_id: 10, name: "Lays", price: 400, qty: 20, line_total: 8000, error: null, candidates: [] },
      { raw: "2 coffee", product_id: 15, name: "Coffee", price: 600, qty: 2, line_total: 1200, error: null, candidates: [] },
    ],
    items: [{ product_id: 10, qty: 20 }, { product_id: 15, qty: 2 }],
    total: 9200,
    ok: true,
  };
  const RESOLVED_BAD = {
    lines: [
      { raw: "20 lays", product_id: 10, name: "Lays", price: 400, qty: 20, line_total: 8000, error: null, candidates: [] },
      { raw: "lola 5", product_id: null, name: null, price: null, qty: null, line_total: null,
        error: "Не удалось определить продукт: lola.", candidates: ["Coffee", "Lays"] },
    ],
    items: [],
    total: 0,
    ok: false,
  };

  const switchToText = async () => {
    await act(async () => { fireEvent.click(screen.getByLabelText("session.addModeText")); });
  };
  const box = () => screen.getByLabelText("session.quickEntry") as HTMLTextAreaElement;
  const type = async (value: string) => {
    await act(async () => { fireEvent.change(box(), { target: { value } }); });
    // The read is debounced: nothing is asked until the typing stops, and the
    // answer lands a few microtasks later — the button is only released when
    // it has.
    await act(async () => { vi.advanceTimersByTime(400); });
    for (let i = 0; i < 5; i++) {
      await act(async () => { await Promise.resolve(); });
    }
  };
  const textConfirm = () =>
    screen.getAllByRole("button").find((b) =>
      b.textContent === "session.quickEntryConfirm" || b.textContent === "session.adding") as HTMLButtonElement;

  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  test("the dialog opens on the picker, not on the box", async () => {
    await mount();

    expect((screen.getByLabelText("session.addModePicker") as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText("session.quickEntry")).toBeNull();
    expect(screen.getByText("session.availableProducts")).toBeTruthy();
  });

  test("switching puts the box in the catalogue's place, and back", async () => {
    await mount();
    await switchToText();

    expect(box()).toBeTruthy();
    expect(screen.queryByText("session.availableProducts")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByLabelText("session.addModePicker")); });
    expect(screen.queryByLabelText("session.quickEntry")).toBeNull();
    expect(screen.getByText("session.availableProducts")).toBeTruthy();
  });

  test("an empty box asks the server nothing", async () => {
    await mount();
    await switchToText();
    await type("   ");

    expect(repo.resolveItemsText).not.toHaveBeenCalled();
  });

  test("typing is read once the typing stops, and shows what would be added", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_OK);
    await mount();
    await switchToText();
    await type("20 lays\n2 coffee");

    expect(repo.resolveItemsText).toHaveBeenCalledTimes(1);
    expect(repo.resolveItemsText).toHaveBeenCalledWith(42, "20 lays\n2 coffee");
    expect(screen.getByText("Lays × 20")).toBeTruthy();
    expect(screen.getByText("Coffee × 2")).toBeTruthy();
    expect(screen.getByText("session.quickEntryTotal")).toBeTruthy();
  });

  /**
   * One request per PAUSE, not per keystroke. A cashier typing four lines
   * would otherwise ask the server forty times for an answer they are still
   * in the middle of writing.
   */
  test("keystrokes in quick succession ask once", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_OK);
    await mount();
    await switchToText();

    await act(async () => { fireEvent.change(box(), { target: { value: "20 la" } }); });
    await act(async () => { vi.advanceTimersByTime(150); });
    await act(async () => { fireEvent.change(box(), { target: { value: "20 lays" } }); });
    await act(async () => { vi.advanceTimersByTime(150); });

    expect(repo.resolveItemsText).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(400); });
    for (let i = 0; i < 5; i++) {
      await act(async () => { await Promise.resolve(); });
    }

    expect(repo.resolveItemsText).toHaveBeenCalledTimes(1);
    expect(repo.resolveItemsText).toHaveBeenCalledWith(42, "20 lays");
  });

  /** Reading is not adding: nothing reaches the bill until the confirm. */
  test("reading the box writes nothing", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_OK);
    await mount();
    await switchToText();
    await type("20 lays");

    expect(repo.addItems).not.toHaveBeenCalled();
  });

  test("the confirm sends the resolved items through the basket's own endpoint", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_OK);
    const { onAdded, onClose } = await mount();
    await switchToText();
    await type("20 lays\n2 coffee");

    await act(async () => { fireEvent.click(textConfirm()); });

    expect(repo.addItems).toHaveBeenCalledTimes(1);
    expect(repo.addItems).toHaveBeenCalledWith(42, [{ product_id: 10, qty: 20 }, { product_id: 15, qty: 2 }]);
    expect(onAdded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test("a line the server could not read is shown, with what it suggests", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_BAD);
    await mount();
    await switchToText();
    await type("20 lays\nlola 5");

    // The box itself holds the typed word too, so the assertion is about the
    // error line: the span carrying the server's sentence.
    const errorLine = [...document.querySelectorAll("span.error")]
      .find((el) => /lola/.test(el.textContent ?? ""));
    expect(errorLine, "the unreadable line is named").toBeTruthy();
    expect(errorLine!.textContent).toContain("Не удалось определить продукт");
    expect(screen.getByText(/Coffee, Lays/)).toBeTruthy();
  });

  /** One bad line holds the whole batch: nothing is added in part. */
  test("the confirm is dead while any line is unreadable", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_BAD);
    await mount();
    await switchToText();
    await type("20 lays\nlola 5");

    expect(textConfirm().disabled).toBe(true);

    await act(async () => { fireEvent.click(textConfirm()); });
    expect(repo.addItems).not.toHaveBeenCalled();
  });

  test("the confirm is dead before anything has been typed", async () => {
    await mount();
    await switchToText();

    expect(textConfirm().disabled).toBe(true);
  });

  /**
   * A 200 carrying something that is not a reading of the box must not take
   * the screen down. Found by a screenshot run against a stub backend, where
   * the catch-all answered `{data: []}` and the dialog reached into
   * `undefined.lines` — a white screen over a live floor.
   */
  test("an answer that is not a reading is refused, not reached into", async () => {
    repo.resolveItemsText.mockResolvedValue({ data: [], meta: { total: 0 } } as never);
    await mount();
    await switchToText();
    await type("20 lays");

    // Still standing, still on the box, and nothing to confirm.
    expect(box().value).toBe("20 lays");
    expect(textConfirm().disabled).toBe(true);
    expect(document.querySelector(".error")).toBeTruthy();
  });

  test("a refusal from the server keeps the text and says why", async () => {
    repo.resolveItemsText.mockResolvedValue(RESOLVED_OK);
    repo.addItems.mockRejectedValue(new Error("This session is no longer active"));
    await mount();
    await switchToText();
    await type("20 lays\n2 coffee");

    await act(async () => { fireEvent.click(textConfirm()); });

    expect(box().value).toBe("20 lays\n2 coffee");
    const failure = document.querySelector(".error");
    expect(failure?.textContent).toContain("This session is no longer active");
  });
});

/**
 * The room's hourly extra, seen from the basket dialog.
 *
 * `price` on such a line is a RATE. Printing `price x qty` here quoted a cue
 * rented at 700/h as a flat 700 next to a receipt that said 1 050, on the one
 * screen a cashier opens to check what is already on the bill.
 */
describe("an hourly extra already on the bill", () => {
  const rented = {
    ...session,
    items: [{
      id: 11, name: "\u041a\u0438\u0439", qty: 1, price: 700,
      is_extra: true, is_hourly: true, minutes: 90, line_total: 1050, returned_at: null,
    }],
  } as unknown as ISessionApi;

  test("shows what the server has counted, not the rate", async () => {
    repo.listProducts.mockResolvedValue(products);
    await mount({ session: rented });

    expect(screen.getByText("1050")).toBeTruthy();
    expect(screen.queryByText("700")).toBeNull();
  });

  test("a fixed line is still priced the old way", async () => {
    repo.listProducts.mockResolvedValue(products);
    await mount({
      session: {
        ...session,
        items: [{ id: 12, name: "Cola", qty: 2, price: 250, line_total: 9999 }],
      } as unknown as ISessionApi,
    });

    // 500, a figure no product in the catalogue carries.
    expect(screen.getByText("500")).toBeTruthy();
    expect(screen.queryByText("9999")).toBeNull();
  });
});

describe("AddSessionItemDialog — a typed name that fits several products", () => {
  const opt = (product_id: number, name: string, price: number, qty: number) => ({ product_id, name, price, line_total: price * qty });
  const colaOptions = (qty: number) => [opt(20, "Coca Cola", 500, qty), opt(21, "Coca Cola can", 700, qty), opt(22, "Coca Cola 1L", 1000, qty)];
  const ambiguous = (raw: string, qty: number) => ({
    raw, status: "ambiguous", product_id: null, name: null, price: null, qty, line_total: null,
    error: "More than one product is called cola.", candidates: ["Coca Cola", "Coca Cola can", "Coca Cola 1L"], options: colaOptions(qty),
  });
  const picked = (raw: string, qty: number, id: number) => {
    const o = colaOptions(qty).find((x) => x.product_id === id)!;
    return { raw, status: "matched", product_id: id, name: o.name, price: o.price, qty, line_total: o.line_total, error: null, candidates: [], options: colaOptions(qty) };
  };
  const LAYS = { raw: "20 lays", status: "matched", product_id: 10, name: "Lays", price: 400, qty: 20, line_total: 8000, error: null, candidates: [], options: [] };
  const AMBIGUOUS = { lines: [ambiguous("cola 5", 5), LAYS], items: [], total: 0, ok: false };
  const PICKED = {
    lines: [picked("cola 5", 5, 21), LAYS],
    items: [{ product_id: 21, qty: 5 }, { product_id: 10, qty: 20 }], total: 11500, ok: true,
  };

  const settle = async () => {
    await act(async () => { vi.advanceTimersByTime(400); });
    for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
  };
  const toText = async () => { await act(async () => { fireEvent.click(screen.getByLabelText("session.addModeText")); }); };
  const box = () => screen.getByLabelText("session.quickEntry") as HTMLTextAreaElement;
  const type = async (value: string) => {
    await act(async () => { box().focus(); fireEvent.change(box(), { target: { value } }); });
    await settle();
  };
  /** A key on the textarea; true when nothing prevented its default. */
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    let untouched = true;
    await act(async () => { untouched = fireEvent.keyDown(box(), { key, ...init }); });
    return untouched;
  };
  const confirm = () => screen.getAllByRole("button").find((b) =>
    b.textContent === "session.quickEntryConfirm" || b.textContent === "session.adding") as HTMLButtonElement;
  const lists = () => screen.queryAllByRole("listbox");
  /** The option the textarea points at — the keyboard's place. */
  const highlighted = () => document.getElementById(box().getAttribute("aria-activedescendant") ?? "")
    ?.querySelector(".quick-pick__name")?.textContent ?? null;
  const option = (name: string) => screen.getAllByRole("option")
    .find((o) => o.querySelector(".quick-pick__name")?.textContent === name) as HTMLElement;
  const lastRead = () => repo.resolveItemsText.mock.calls.at(-1)!;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Element.prototype.scrollIntoView = () => {};
  });
  afterEach(() => { vi.useRealTimers(); });

  test("a unique name shows no list and reads as before", async () => {
    repo.resolveItemsText.mockResolvedValue({ lines: [LAYS], items: [{ product_id: 10, qty: 20 }], total: 8000, ok: true });
    await mount();
    await toText();
    await type("20 lays");

    expect(lists()).toHaveLength(0);
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
    expect(screen.getByText("Lays × 20")).toBeTruthy();
    expect(confirm().disabled).toBe(false);
  });

  test("a name matching nothing keeps its old refusal and no list", async () => {
    repo.resolveItemsText.mockResolvedValue({
      lines: [{ raw: "random 5", status: "unmatched", product_id: null, name: null, price: null, qty: 5, line_total: null,
        error: "No such product.", candidates: [], options: [] }],
      items: [], total: 0, ok: false,
    });
    await mount();
    await toText();
    await type("random 5");

    expect(lists()).toHaveLength(0);
    expect(screen.getByText(/No such product\./)).toBeTruthy();
    expect(confirm().disabled).toBe(true);
    expect(await press("Enter")).toBe(true);
  });

  test("an ambiguous line opens its list: every option with its price, the FIRST highlighted, nothing chosen", async () => {
    repo.resolveItemsText.mockResolvedValue(AMBIGUOUS);
    await mount();
    await toText();
    await type("cola 5\n20 lays");

    expect(lists()).toHaveLength(1);
    expect(document.querySelectorAll(".quick-pick input[type=radio]")).toHaveLength(0);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Coca Cola500", "Coca Cola can700", "Coca Cola 1L1000"]);
    expect(highlighted()).toBe("Coca Cola");
    // The focus stayed in the box — typing goes on uninterrupted.
    expect(document.activeElement).toBe(box());
    // Highlighted is not chosen: no pick was sent, the add waits.
    expect(repo.resolveItemsText).toHaveBeenCalledTimes(1);
    expect(lastRead()).toEqual([42, "cola 5\n20 lays"]);
    expect(confirm().disabled).toBe(true);
    expect(document.body.textContent).toContain("session.quickEntryPickPending");
    expect(screen.getByText("Lays × 20")).toBeTruthy();
  });

  test("↓ and ↑ move the highlight (wrapping), not the caret", async () => {
    repo.resolveItemsText.mockResolvedValue(AMBIGUOUS);
    await mount();
    await toText();
    await type("cola 5\n20 lays");

    expect(await press("ArrowDown")).toBe(false);
    expect(highlighted()).toBe("Coca Cola can");
    await press("ArrowDown");
    expect(highlighted()).toBe("Coca Cola 1L");
    await press("ArrowUp");
    expect(highlighted()).toBe("Coca Cola can");
    await press("ArrowUp");
    await press("ArrowUp");
    expect(highlighted()).toBe("Coca Cola 1L");
    expect(repo.resolveItemsText).toHaveBeenCalledTimes(1);
  });

  test("Enter picks the highlighted product: the list closes, the line reads ✓ with its quantity and price, typing goes on", async () => {
    repo.resolveItemsText.mockResolvedValueOnce(AMBIGUOUS).mockResolvedValue(PICKED);
    await mount();
    await toText();
    await type("cola 5\n20 lays");

    await press("ArrowDown");
    expect(await press("Enter")).toBe(false);
    // Closed at once, before the answer: no second Enter can land on it.
    expect(lists()).toHaveLength(0);
    await settle();

    expect(lastRead()).toEqual([42, "cola 5\n20 lays", [{ line: 0, raw: "cola 5", product_id: 21 }]]);
    expect(lists()).toHaveLength(0);
    expect(screen.getByText("✓ Coca Cola can × 5")).toBeTruthy();
    expect(screen.getByText("700 × 5 = 3500")).toBeTruthy();
    expect(document.activeElement).toBe(box());
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
    // Enter only picked.
    expect(repo.addItems).not.toHaveBeenCalled();
    expect(confirm().disabled).toBe(false);
    // The box is a textarea again: Enter and the arrows are its own.
    expect(await press("Enter")).toBe(true);
    expect(await press("ArrowDown")).toBe(true);
  });

  test("a click picks through the same path and puts the focus back in the box", async () => {
    repo.resolveItemsText.mockResolvedValueOnce(AMBIGUOUS).mockResolvedValue(PICKED);
    await mount();
    await toText();
    await type("cola 5\n20 lays");
    act(() => { (document.activeElement as HTMLElement | null)?.blur(); });

    await act(async () => { fireEvent.mouseDown(option("Coca Cola can")); fireEvent.click(option("Coca Cola can")); });
    await settle();

    expect(lastRead()).toEqual([42, "cola 5\n20 lays", [{ line: 0, raw: "cola 5", product_id: 21 }]]);
    expect(screen.getByText("✓ Coca Cola can × 5")).toBeTruthy();
    expect(lists()).toHaveLength(0);
    expect(document.activeElement).toBe(box());
  });

  test("a held Enter picks once; Shift+Enter is still a new line", async () => {
    repo.resolveItemsText.mockResolvedValue(AMBIGUOUS);
    await mount();
    await toText();
    await type("cola 5\n20 lays");

    expect(await press("Enter", { shiftKey: true })).toBe(true);
    expect(await press("Enter", { repeat: true })).toBe(false);
    await settle();
    expect(repo.resolveItemsText).toHaveBeenCalledTimes(1);
    expect(lists()).toHaveLength(1);
  });

  test("Escape folds the list — the dialog, the text and the pending line stay — and «Choose» reopens it", async () => {
    repo.resolveItemsText.mockResolvedValue(AMBIGUOUS);
    const { onClose } = await mount();
    await toText();
    await type("cola 5\n20 lays");

    expect(await press("Escape")).toBe(false);
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("modal.leaveConfirm");
    expect(lists()).toHaveLength(0);
    expect(box().value).toBe("cola 5\n20 lays");
    expect(confirm().disabled).toBe(true);
    // Folded, the keys are the textarea's again.
    expect(await press("Enter")).toBe(true);
    expect(await press("ArrowDown")).toBe(true);

    await act(async () => { fireEvent.click(screen.getByText("session.quickEntryPickOpen")); });
    expect(lists()).toHaveLength(1);
    expect(document.activeElement).toBe(box());
  });

  test("with no list open, Escape is the dialog's", async () => {
    repo.resolveItemsText.mockResolvedValue({ lines: [LAYS], items: [{ product_id: 10, qty: 20 }], total: 8000, ok: true });
    await mount();
    await toText();
    await type("20 lays");
    expect(await press("Escape")).toBe(true);
  });

  test("two ambiguous lines: one list at a time, the next opens after the answer, each keeps its product and quantity", async () => {
    const TWO = { lines: [ambiguous("cola 5", 5), LAYS, ambiguous("cola 3", 3)], items: [], total: 0, ok: false };
    const FIRST = { ...TWO, lines: [picked("cola 5", 5, 21), LAYS, ambiguous("cola 3", 3)] };
    const BOTH = {
      lines: [picked("cola 5", 5, 21), LAYS, picked("cola 3", 3, 20)],
      items: [{ product_id: 21, qty: 5 }, { product_id: 10, qty: 20 }, { product_id: 20, qty: 3 }], total: 13000, ok: true,
    };
    // The answer to the first pick is held back, so "before the answer" is a
    // fact of the test, not a race against the machine's load.
    let answerFirst: (v: unknown) => void = () => {};
    repo.resolveItemsText.mockResolvedValueOnce(TWO)
      .mockReturnValueOnce(new Promise((r) => { answerFirst = r; }))
      .mockResolvedValue(BOTH);
    await mount();
    await toText();
    await type("cola 5\n20 lays\ncola 3");

    expect(lists()).toHaveLength(1);
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toContain("cola 5");
    await press("ArrowDown");
    await press("Enter");
    await settle();
    // A fast second Enter before the answer lands on nothing.
    expect(lists()).toHaveLength(0);
    expect(await press("Enter")).toBe(true);
    await act(async () => { answerFirst(FIRST); });
    await settle();

    expect(lastRead()).toEqual([42, "cola 5\n20 lays\ncola 3", [{ line: 0, raw: "cola 5", product_id: 21 }]]);
    expect(lists()).toHaveLength(1);
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toContain("cola 3");
    expect(highlighted()).toBe("Coca Cola");

    await press("Enter");
    await settle();
    expect(lastRead()).toEqual([42, "cola 5\n20 lays\ncola 3", [
      { line: 0, raw: "cola 5", product_id: 21 },
      { line: 2, raw: "cola 3", product_id: 20 },
    ]]);
    expect(lists()).toHaveLength(0);

    await act(async () => { fireEvent.click(confirm()); });
    expect(repo.addItems).toHaveBeenCalledWith(42, [{ product_id: 21, qty: 5 }, { product_id: 10, qty: 20 }, { product_id: 20, qty: 3 }]);
  });

  test("× takes a wrong pick out of the draft — its product id with it — and leaves the other lines alone", async () => {
    repo.resolveItemsText.mockResolvedValueOnce(AMBIGUOUS).mockResolvedValueOnce(PICKED)
      .mockResolvedValueOnce({ lines: [LAYS], items: [{ product_id: 10, qty: 20 }], total: 8000, ok: true })
      .mockResolvedValueOnce({ lines: [LAYS, ambiguous("cola 5", 5)], items: [], total: 0, ok: false })
      .mockResolvedValue({ lines: [LAYS, picked("cola 5", 5, 20)], items: [{ product_id: 10, qty: 20 }, { product_id: 20, qty: 5 }], total: 10500, ok: true });
    await mount();
    await toText();
    await type("cola 5\n20 lays");
    await press("ArrowDown");
    await press("Enter");
    await settle();

    const removedBefore = repo.removeItem.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByLabelText("action.remove: Coca Cola can × 5")); });
    await settle();

    expect(box().value).toBe("20 lays");
    // Read again at once, with no pick left over.
    expect(lastRead()).toEqual([42, "20 lays"]);
    expect(screen.getByText("Lays × 20")).toBeTruthy();
    expect(screen.queryByText("✓ Coca Cola can × 5")).toBeNull();
    expect(document.activeElement).toBe(box());
    // A draft edit: nothing written, nothing removed from the bill.
    expect(repo.addItems).not.toHaveBeenCalled();
    expect(repo.removeItem.mock.calls.length).toBe(removedBefore);

    // Typed again, it asks again — and the right product can be chosen.
    await type("20 lays\ncola 5");
    expect(lists()).toHaveLength(1);
    expect(highlighted()).toBe("Coca Cola");
    await press("Enter");
    await settle();
    expect(lastRead()).toEqual([42, "20 lays\ncola 5", [{ line: 1, raw: "cola 5", product_id: 20 }]]);
    await act(async () => { fireEvent.click(confirm()); });
    expect(repo.addItems).toHaveBeenCalledWith(42, [{ product_id: 10, qty: 20 }, { product_id: 20, qty: 5 }]);
  });

  test("removing one picked line keeps the other line's pick, moved up with it", async () => {
    const TWO = { lines: [ambiguous("cola 5", 5), ambiguous("cola 3", 3)], items: [], total: 0, ok: false };
    const FIRST = { ...TWO, lines: [picked("cola 5", 5, 21), ambiguous("cola 3", 3)] };
    const BOTH = { lines: [picked("cola 5", 5, 21), picked("cola 3", 3, 22)], items: [{ product_id: 21, qty: 5 }, { product_id: 22, qty: 3 }], total: 6500, ok: true };
    const REST = { lines: [picked("cola 3", 3, 22)], items: [{ product_id: 22, qty: 3 }], total: 3000, ok: true };
    repo.resolveItemsText.mockResolvedValueOnce(TWO).mockResolvedValueOnce(FIRST).mockResolvedValueOnce(BOTH).mockResolvedValue(REST);
    await mount();
    await toText();
    await type("cola 5\ncola 3");
    await press("ArrowDown");
    await press("Enter");
    await settle();
    await press("ArrowUp");
    await press("Enter");
    await settle();

    await act(async () => { fireEvent.click(screen.getByLabelText("action.remove: Coca Cola can × 5")); });
    await settle();
    expect(box().value).toBe("cola 3");
    expect(lastRead()).toEqual([42, "cola 3", [{ line: 0, raw: "cola 3", product_id: 22 }]]);
    expect(screen.getByText("✓ Coca Cola 1L × 3")).toBeTruthy();
  });

  test("the add stays off while any line waits, and a double press adds once", async () => {
    repo.resolveItemsText.mockResolvedValueOnce(AMBIGUOUS).mockResolvedValue(PICKED);
    repo.addItems.mockReturnValue(new Promise(() => {}));
    await mount();
    await toText();
    await type("cola 5\n20 lays");
    expect(confirm().disabled).toBe(true);
    await act(async () => { fireEvent.click(confirm()); });
    expect(repo.addItems).not.toHaveBeenCalled();

    await press("ArrowDown");
    await press("Enter");
    await settle();
    await act(async () => { fireEvent.click(confirm()); fireEvent.click(confirm()); });
    expect(repo.addItems).toHaveBeenCalledTimes(1);
    expect(repo.addItems).toHaveBeenCalledWith(42, [{ product_id: 21, qty: 5 }, { product_id: 10, qty: 20 }]);
  });

  test("editing the text drops a pick made for the old text", async () => {
    repo.resolveItemsText.mockResolvedValueOnce(AMBIGUOUS).mockResolvedValueOnce(PICKED)
      .mockResolvedValue({ ...AMBIGUOUS, lines: [ambiguous("cola 7", 7), LAYS] });
    await mount();
    await toText();
    await type("cola 5\n20 lays");
    await press("Enter");
    await settle();

    await type("cola 7\n20 lays");
    await settle();

    const last = lastRead();
    expect(last.length === 2 || (last[2] as unknown[]).every((c) => (c as { raw: string }).raw !== "cola 5")).toBe(true);
    expect(confirm().disabled).toBe(true);
    expect(lists()).toHaveLength(1);
  });
});

describe("AddSessionItemDialog — withdrawn products", () => {
  test("the picker does not offer a withdrawn product", async () => {
    repo.listProducts.mockResolvedValue([...products, { id: 30, branch_id: 1, name: "Old Tea", category: "Drinks", price: 100, is_active: false }]);
    await mount();
    expect(screen.queryByText("Old Tea")).toBeNull();
    expect(screen.getByText("Lays")).toBeTruthy();
  });
});

