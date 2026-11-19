// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISalesLine } from "@/api/salesSummary";

/**
 * «Изменить способ оплаты» (2026-11-19): the same total; the server decides
 * whether it may; the panel sends how it was paid once and reads it back.
 */
const repo = vi.hoisted(() => ({ changePayment: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: { changePayment: (...a: unknown[]) => repo.changePayment(...a) },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n) }) }));
vi.mock("@/components/payments/PaymentEditor", () => ({
  default: ({ value, onChange }: { value: { method: string }; onChange: (v: unknown) => void }) => (
    <div>
      <span data-testid="method">{value.method}</span>
      <button type="button" onClick={() => onChange({ ...value, method: "cash" })}>to-cash</button>
    </div>
  ),
}));

import ChangePaymentDialog, { canChangePayment } from "./ChangePaymentDialog";

const line = (over: Partial<ISalesLine> = {}): ISalesLine => ({
  kind: "place", id: 385, at: "2026-11-19T16:18:14+04:00", seat: "№1", place: { id: 1, number: 1, name: "Սրահ 1" },
  staff: null, is_free: false, method: "cash", payments: [{ method: "cash", amount: "2000.00" }] as never, amount: "2000.00", prepaid: null, ...over,
});

beforeEach(() => { repo.changePayment.mockReset(); repo.changePayment.mockResolvedValue({ id: 385 }); });
afterEach(cleanup);

describe("canChangePayment", () => {
  test("a place with money, not paid ahead: yes; a sale, a free seat, zero, paid ahead: no", () => {
    expect(canChangePayment(line())).toBe(true);
    expect(canChangePayment(line({ kind: "till" }))).toBe(false);
    expect(canChangePayment(line({ is_free: true }))).toBe(false);
    expect(canChangePayment(line({ amount: "0.00" }))).toBe(false);
    expect(canChangePayment(line({ prepaid: "1000.00" }))).toBe(false);
  });
});

describe("ChangePaymentDialog", () => {
  test("starts on card; Save sends {payment_method: card} for this seat once, then reloads and closes", async () => {
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(<ChangePaymentDialog branchId={5} line={line()} onClose={onClose} onChanged={onChanged} />);
    expect(screen.getByTestId("method").textContent).toBe("card");
    await act(async () => { fireEvent.click(screen.getByTestId("change-payment-save")); });
    expect(repo.changePayment).toHaveBeenCalledTimes(1);
    expect(repo.changePayment).toHaveBeenCalledWith(385, { payment_method: "card" });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the server's refusal is shown, nothing reloaded, the dialog stays", async () => {
    repo.changePayment.mockRejectedValue(new Error("Кассовая смена закрыта."));
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(<ChangePaymentDialog branchId={5} line={line()} onClose={onClose} onChanged={onChanged} />);
    await act(async () => { fireEvent.click(screen.getByTestId("change-payment-save")); });
    expect(screen.getByTestId("change-payment-error").textContent).toBe("Кассовая смена закрыта.");
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("another way chosen is what is sent", async () => {
    render(<ChangePaymentDialog branchId={5} line={line()} onClose={() => {}} onChanged={() => {}} />);
    fireEvent.click(screen.getByText("to-cash"));
    await act(async () => { fireEvent.click(screen.getByTestId("change-payment-save")); });
    expect(repo.changePayment).toHaveBeenCalledWith(385, { payment_method: "cash" });
  });
});
