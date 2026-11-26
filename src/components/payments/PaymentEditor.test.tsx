// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useState } from "react";
const labels = vi.hoisted(() => ({ fn: vi.fn(async (_b: number) => ({ data: [] as { label: string; uses: number }[] })) }));
vi.mock("@/api/paymentLabels", () => ({ apiPaymentLabels: (b: number) => labels.fn(b) }));
// «Все бонусы» asks first; a card on the bill draws it (2026-11-26 test).
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));
import PaymentEditor from "./PaymentEditor";
import { checkPayment, emptyPaymentDraft, type PaymentDraft } from "./paymentSplit";

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k.startsWith("pay.re") || k === "pay.tooMuch" ? `${k} {0}` : k), money: (n: number) => String(n), lang: "en", currency: "AMD" }),
}));

let last: PaymentDraft = emptyPaymentDraft();
const Host = ({ due, branchId }: { due: number; branchId?: number }) => {
  const [d, setD] = useState<PaymentDraft>(emptyPaymentDraft());
  last = d;
  return <PaymentEditor name="p" dueCents={due} value={d} onChange={setD} check={checkPayment(due, d)} money={String} branchId={branchId} />;
};
afterEach(cleanup);

describe("PaymentEditor", () => {
  test("each method button shows one short word; the full name is its tooltip and name (2026-11-08)", () => {
    render(<Host due={500000} />);
    const other = screen.getByTestId("pay-other");
    expect(other.textContent).toBe("pay.otherShort");
    expect(other.getAttribute("title")).toBe("session.payOther");
    expect(other.getAttribute("aria-label")).toBe("session.payOther");
    expect(screen.getByTestId("pay-cash").textContent).toBe("session.payCash");
    expect(screen.getByTestId("pay-card").textContent).toBe("session.payCard");
  });

  test("cash by default; a method is one click", async () => {
    render(<Host due={500000} />);
    expect(screen.getByTestId("pay-cash").getAttribute("aria-checked")).toBe("true");
    await act(async () => { fireEvent.click(screen.getByTestId("pay-card")); });
    expect(last).toMatchObject({ split: false, method: "card" });
    expect(screen.queryByTestId("pay-remaining")).toBeNull();
  });

  test("split: boxes per method, what is still due, the rest in one click, and an optional note", async () => {
    render(<Host due={500000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    const boxes = screen.getAllByRole("textbox").filter((e) => e.tagName === "INPUT");
    await act(async () => { fireEvent.change(boxes[1], { target: { value: "3000" } }); });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.remaining 2000");
    await act(async () => { fireEvent.click(screen.getByTestId("pay-rest-cash")); });
    expect(last.amounts).toMatchObject({ card: "3000", cash: "2000.00" });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.allPaid");
    // No note needed (2026-11-15, owner): the parts adding up is enough.
    expect(checkPayment(500000, last)).toMatchObject({ ok: true, problem: null });
    expect(screen.getByText("pay.note").textContent).toBe("pay.note");
    expect(screen.queryByText(/\*/)).toBeNull();
    await act(async () => { fireEvent.change(screen.getByTestId("pay-note"), { target: { value: "3000 картой" } }); });
    expect(checkPayment(500000, last).ok).toBe(true);
  });

  test("nothing typed in a split: one line says what is still due, no second hint", async () => {
    render(<Host due={500000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.remaining 5000");
    expect(screen.queryByText("pay.needAmount")).toBeNull();
  });

  test("too much is said as such", async () => {
    render(<Host due={100000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    const boxes = screen.getAllByRole("textbox").filter((e) => e.tagName === "INPUT");
    await act(async () => { fireEvent.change(boxes[0], { target: { value: "800" } }); });
    await act(async () => { fireEvent.change(boxes[1], { target: { value: "500" } }); });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.tooMuch 300");
  });

  test("«Другое» is not a split row; «+ Свой вариант» adds a named one, × takes it away (2026-11-18)", async () => {
    render(<Host due={500000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    expect(screen.queryByTestId("pay-own-row")).toBeNull();
    expect(screen.queryByTestId("pay-rest-other")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    expect(screen.getByTestId("pay-own-row")).toBeTruthy();
    // Changed 2026-11-19 (owner): «+ Свой вариант» stays, it adds another row.
    expect(screen.getByTestId("pay-own-add")).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByTestId("pay-own-name"), { target: { value: "Hovo Card" } }); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-rest-other")); });
    expect(last.own).toEqual([{ id: 1, label: "Hovo Card", amount: "5000.00" }]);
    expect(checkPayment(500000, last).lines).toEqual([{ method: "other", amount: 5000, label: "Hovo Card" }]);

    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-remove")); });
    expect(screen.queryByTestId("pay-own-row")).toBeNull();
    expect(last.own).toEqual([]);
  });

  /**
   * 2026-11-18 (owner): whatever was typed and switched on the way, what is
   * sent is exactly the LAST choice — never a leftover of an earlier one.
   */
  test("after any switching, exactly the last choice is sent", async () => {
    const { paymentBody } = await import("./paymentSplit");
    const body = () => paymentBody(last, checkPayment(500000, last));
    render(<Host due={500000} />);

    // Split typed in full (cash 2000 + «Idram» 3000)…
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    const boxes = () => screen.getAllByRole("textbox").filter((e) => e.tagName === "INPUT" && !e.getAttribute("data-testid"));
    await act(async () => { fireEvent.change(boxes()[0], { target: { value: "2000" } }); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    await act(async () => { fireEvent.change(screen.getByTestId("pay-own-name"), { target: { value: "Idram" } }); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-rest-other")); });
    expect(body()).toEqual({ payments: [{ method: "cash", amount: 2000 }, { method: "other", amount: 3000, label: "Idram" }] });

    // …then card: card for the whole bill, no parts, no name.
    await act(async () => { fireEvent.click(screen.getByTestId("pay-card")); });
    expect(body()).toEqual({ payment_method: "card" });

    // …then cash: cash.
    await act(async () => { fireEvent.click(screen.getByTestId("pay-cash")); });
    expect(body()).toEqual({ payment_method: "cash" });

    // …back to split, the own option removed: only what is still shown, and
    // it must add up again before anything can be sent.
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-remove")); });
    expect(checkPayment(500000, last)).toMatchObject({ ok: false, problem: "sum", remainingCents: 300000 });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-rest-card")); });
    expect(body()).toEqual({ payments: [{ method: "cash", amount: 2000 }, { method: "card", amount: 3000 }] });
  });

  test("a name the branch already used is one press: it opens the row with that name (2026-11-18)", async () => {
    labels.fn.mockResolvedValueOnce({ data: [{ label: "Telcell", uses: 4 }, { label: "Hovo Card", uses: 1 }] });
    render(<Host due={500000} branchId={7} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    await act(async () => { await Promise.resolve(); });
    expect(labels.fn).toHaveBeenCalledWith(7);
    expect(screen.getByTestId("pay-own-saved-Telcell").textContent).toBe("+ Telcell");
    expect(screen.getByTestId("pay-own-add")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-saved-Telcell")); });
    expect(last.own).toEqual([{ id: 1, label: "Telcell", amount: "" }]);
    expect((screen.getByTestId("pay-own-name") as HTMLInputElement).value).toBe("Telcell");
    // A name already in a row is not offered again (2026-11-19).
    expect(screen.queryByTestId("pay-own-saved-Telcell")).toBeNull();
    expect(screen.getByTestId("pay-own-saved-Hovo Card")).toBeTruthy();
    // A new name: the empty row, as before.
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-remove")); });
    expect(screen.getByTestId("pay-own-saved-Telcell")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    expect(last.own).toEqual([{ id: 1, label: "", amount: "" }]);
  });

  test("no branch, or a failed read: just «+ Свой вариант»", async () => {
    labels.fn.mockRejectedValueOnce(new Error("offline"));
    render(<Host due={500000} branchId={7} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/^\+ (?!pay)/)).toBeNull();
    expect(screen.getByTestId("pay-own-add")).toBeTruthy();
  });

  test("several own options (2026-11-19): each press adds a row; cash + Idram + Telcell adds up and is sent as three parts", async () => {
    const { paymentBody } = await import("./paymentSplit");
    labels.fn.mockResolvedValueOnce({ data: [{ label: "Telcell", uses: 2 }] });
    render(<Host due={500000} branchId={7} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    await act(async () => { await Promise.resolve(); });
    const cash = screen.getAllByRole("textbox").filter((e) => e.tagName === "INPUT")[0];
    await act(async () => { fireEvent.change(cash, { target: { value: "1000" } }); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    await act(async () => { fireEvent.change(screen.getByTestId("pay-own-name"), { target: { value: "Idram" } }); });
    const idramBox = screen.getAllByTestId("pay-own-row")[0].querySelectorAll("input")[1];
    await act(async () => { fireEvent.change(idramBox, { target: { value: "1500" } }); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-saved-Telcell")); });
    expect(screen.getAllByTestId("pay-own-row")).toHaveLength(2);
    await act(async () => { fireEvent.click(screen.getAllByTestId("pay-rest-other")[1]); });
    expect(last.own).toEqual([{ id: 1, label: "Idram", amount: "1500" }, { id: 2, label: "Telcell", amount: "2500.00" }]);
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.allPaid");
    expect(paymentBody(last, checkPayment(500000, last))).toEqual({
      payments: [
        { method: "cash", amount: 1000 },
        { method: "other", amount: 1500, label: "Idram" },
        { method: "other", amount: 2500, label: "Telcell" },
      ],
    });
    // × on the first row takes only that one away.
    await act(async () => { fireEvent.click(screen.getAllByTestId("pay-own-remove")[0]); });
    expect(last.own).toEqual([{ id: 2, label: "Telcell", amount: "2500.00" }]);
  });

  test("a repeated name is refused on its row in plain words, and the payment cannot go", async () => {
    render(<Host due={500000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    // Two without a name: the second is told to take one.
    expect(screen.getAllByTestId("pay-own-duplicate").map((e) => e.textContent)).toEqual(["pay.ownUnnamedTwice"]);
    expect(checkPayment(500000, last).problem).toBe("duplicate");
    const names = () => screen.getAllByTestId("pay-own-name") as HTMLInputElement[];
    await act(async () => { fireEvent.change(names()[0], { target: { value: "Idram" } }); });
    expect(screen.queryByTestId("pay-own-duplicate")).toBeNull();
    await act(async () => { fireEvent.change(names()[1], { target: { value: "IDRAM" } }); });
    expect(screen.getAllByTestId("pay-own-duplicate").map((e) => e.textContent)).toEqual(["pay.ownDuplicate"]);
    expect(names()[1].getAttribute("aria-invalid")).toBe("true");
    expect(names()[0].getAttribute("aria-invalid")).toBeNull();
    await act(async () => { fireEvent.change(names()[1], { target: { value: "Telcell" } }); });
    expect(screen.queryByTestId("pay-own-duplicate")).toBeNull();
  });

  test("at most six own options: the server takes 8 parts in all (2026-11-19)", async () => {
    render(<Host due={500000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    for (let i = 0; i < 6; i++) {
      await act(async () => { fireEvent.click(screen.getByTestId("pay-own-add")); });
    }
    expect(last.own).toHaveLength(6);
    expect(screen.queryByTestId("pay-own-add")).toBeNull();
  });

  test("a frozen card (2026-11-26): no «Бонусы» way, no bonus part, and the cashier is told why", async () => {
    const Bonus = ({ frozen }: { frozen: boolean }) => {
      const [d, setD] = useState<PaymentDraft>(emptyPaymentDraft());
      return <PaymentEditor name="p" dueCents={50000} value={d} onChange={setD} check={checkPayment(50000, d)} money={String} bonus={{ balanceCents: 100000, frozen }} />;
    };
    render(<Bonus frozen={false} />);
    expect(screen.getByTestId("pay-bonus")).toBeTruthy();
    expect(screen.getByTestId("pay-bonus-box")).toBeTruthy();
    expect(screen.queryByTestId("pay-bonus-frozen")).toBeNull();
    cleanup();
    render(<Bonus frozen />);
    expect(screen.queryByTestId("pay-bonus")).toBeNull();
    expect(screen.queryByTestId("pay-bonus-box")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    expect(screen.queryByTestId("pay-bonus-row")).toBeNull();
    expect(screen.getByTestId("pay-bonus-frozen").textContent).toBe("pay.bonusFrozen");
  });
});
