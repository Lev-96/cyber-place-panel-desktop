// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useState } from "react";
import PaymentEditor from "./PaymentEditor";
import { checkPayment, emptyPaymentDraft, type PaymentDraft } from "./paymentSplit";

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k.startsWith("pay.re") || k === "pay.tooMuch" ? `${k} {0}` : k), money: (n: number) => String(n), lang: "en", currency: "AMD" }),
}));

let last: PaymentDraft = emptyPaymentDraft();
const Host = ({ due }: { due: number }) => {
  const [d, setD] = useState<PaymentDraft>(emptyPaymentDraft());
  last = d;
  return <PaymentEditor name="p" dueCents={due} value={d} onChange={setD} check={checkPayment(due, d)} money={String} />;
};
afterEach(cleanup);

describe("PaymentEditor", () => {
  test("cash by default; a method is one click", async () => {
    render(<Host due={500000} />);
    expect(screen.getByTestId("pay-cash").getAttribute("aria-checked")).toBe("true");
    await act(async () => { fireEvent.click(screen.getByTestId("pay-card")); });
    expect(last).toMatchObject({ split: false, method: "card" });
    expect(screen.queryByTestId("pay-remaining")).toBeNull();
  });

  test("split: boxes per method, what is still due, the rest in one click, and a note", async () => {
    render(<Host due={500000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    const boxes = screen.getAllByRole("textbox").filter((e) => e.tagName === "INPUT");
    await act(async () => { fireEvent.change(boxes[1], { target: { value: "3000" } }); });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.remaining 2000");
    await act(async () => { fireEvent.click(screen.getByTestId("pay-rest-cash")); });
    expect(last.amounts).toMatchObject({ card: "3000", cash: "2000.00" });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.allPaid");
    expect(checkPayment(500000, last).problem).toBe("note");
    await act(async () => { fireEvent.change(screen.getByTestId("pay-note"), { target: { value: "3000 картой" } }); });
    expect(checkPayment(500000, last).ok).toBe(true);
  });

  test("too much is said as such", async () => {
    render(<Host due={100000} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    const boxes = screen.getAllByRole("textbox").filter((e) => e.tagName === "INPUT");
    await act(async () => { fireEvent.change(boxes[0], { target: { value: "800" } }); });
    await act(async () => { fireEvent.change(boxes[1], { target: { value: "500" } }); });
    expect(screen.getByTestId("pay-remaining").textContent).toBe("pay.tooMuch 300");
  });
});
