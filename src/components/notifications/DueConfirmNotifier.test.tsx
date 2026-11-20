// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IDueToConfirm } from "@/api/sessions";

/**
 * «Подтверждение оплаты» (2026-11-20): an ended seat paid ahead that owed
 * more is asked about until answered; the answer is the way of paying, sent
 * once; nothing is computed here.
 */
const repo = vi.hoisted(() => ({ duesToConfirm: vi.fn(), confirmDue: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "manager" }));
vi.mock("@/repositories/SessionRepository", () => ({ sessionRepository: repo }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}` }) }));
vi.mock("@/sound/soundEngine", () => ({ playFor: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/payments/PaymentEditor", () => ({
  default: ({ value, onChange }: { value: { method: string }; onChange: (v: unknown) => void }) => (
    <div>
      <span data-testid="method">{value.method}</span>
      <button type="button" onClick={() => onChange({ ...value, method: "cash" })}>to-cash</button>
    </div>
  ),
}));

import DueConfirmNotifier, { paidAheadMethod } from "./DueConfirmNotifier";
import { afterDueConfirmed } from "./dueConfirmGate";

const due = (over: Partial<IDueToConfirm> = {}): IDueToConfirm => ({
  session_id: 7, branch_id: 1, place: { id: 4, number: 4, name: "VIP" }, ended_at: "2026-11-19T21:00:00+04:00",
  total: "2000.00", prepaid: "1000.00", due: "1000.00", prepaid_by_method: { card: "1000.00" },
  items: [{ name: "Cola", qty: 2, price: "500.00" }], ...over,
});
const mount = async () => { await act(async () => { render(<DueConfirmNotifier />); }); await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  auth.role = "manager";
  repo.duesToConfirm.mockReset();
  repo.confirmDue.mockReset();
  repo.duesToConfirm.mockResolvedValue([due()]);
  repo.confirmDue.mockResolvedValue({ session: { id: 7 }, cash: null });
});
afterEach(cleanup);

describe("DueConfirmNotifier", () => {
  test("asks about the seat: the products, the due, what was paid ahead", async () => {
    await mount();
    expect(screen.getByTestId("due-confirm")).toBeTruthy();
    expect(screen.getByTestId("due-confirm-items").textContent).toContain("Cola × 2");
    expect(screen.getByTestId("due-confirm-items").textContent).toContain("1000");
    expect(screen.getByTestId("due-confirm-due").textContent).toContain("1000");
    expect(screen.getByTestId("due-confirm-ahead").textContent).toBe("dueConfirm.ahead");
  });

  test("«Да» starts on the way it was paid ahead (card) and sends it once", async () => {
    repo.duesToConfirm.mockResolvedValueOnce([due()]).mockResolvedValue([]);
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-yes")); });
    expect(screen.getByTestId("method").textContent).toBe("card");
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-save")); });
    expect(repo.confirmDue).toHaveBeenCalledTimes(1);
    expect(repo.confirmDue).toHaveBeenCalledWith(7, { payment_method: "card" });
    expect(screen.queryByTestId("due-confirm")).toBeNull();
  });

  test("«Нет» takes it now, starting on cash", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-no")); });
    expect(screen.getByTestId("method").textContent).toBe("cash");
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-save")); });
    expect(repo.confirmDue).toHaveBeenCalledWith(7, { payment_method: "cash" });
  });

  test("«Позже» puts it away; the server's refusal stays on screen", async () => {
    repo.duesToConfirm.mockResolvedValue([due(), due({ session_id: 8 })]);
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-later")); });
    expect(screen.getByTestId("due-confirm")).toBeTruthy();
    repo.confirmDue.mockRejectedValue(new Error("Смена закрыта."));
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-yes")); });
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-save")); });
    expect(repo.confirmDue).toHaveBeenCalledWith(8, { payment_method: "card" });
    expect(screen.getByTestId("due-confirm-error").textContent).toBe("Смена закрыта.");
  });

  test("an admin and an empty list: nothing", async () => {
    auth.role = "admin";
    await mount();
    expect(repo.duesToConfirm).not.toHaveBeenCalled();
    expect(screen.queryByTestId("due-confirm")).toBeNull();
    cleanup();
    auth.role = "company_owner";
    repo.duesToConfirm.mockResolvedValue([]);
    await mount();
    expect(screen.queryByTestId("due-confirm")).toBeNull();
  });

  test("paidAheadMethod: one way → that way; mixed or none → cash", () => {
    expect(paidAheadMethod(due())).toBe("card");
    expect(paidAheadMethod(due({ prepaid_by_method: { card: "500.00", cash: "500.00" } }))).toBe("cash");
    expect(paidAheadMethod(due({ prepaid_by_method: {} }))).toBe("cash");
  });
});

/**
 * The order after a seat ends by itself (2026-11-20, owner): «оплатили?»
 * first, the board's final bill only once it is answered — and at once when
 * that seat has nothing to confirm.
 */
describe("DueConfirmNotifier — first the question, then the bill", () => {
  const endedSeat = async (id: number) => {
    const bill = vi.fn();
    await act(async () => { afterDueConfirmed(id, bill); });
    await act(async () => { await Promise.resolve(); });
    return bill;
  };

  test("a seat owing more: the window opens at once and the bill waits for «Да» + the way of paying", async () => {
    repo.duesToConfirm.mockResolvedValue([]);
    await mount();
    expect(screen.queryByTestId("due-confirm")).toBeNull();
    repo.duesToConfirm.mockResolvedValueOnce([due()]).mockResolvedValue([]);
    const bill = await endedSeat(7);
    expect(screen.getByTestId("due-confirm")).toBeTruthy();
    expect(bill).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-yes")); });
    expect(bill).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-save")); });
    expect(repo.confirmDue).toHaveBeenCalledWith(7, { payment_method: "card" });
    expect(screen.queryByTestId("due-confirm")).toBeNull();
    expect(bill).toHaveBeenCalledTimes(1);
  });

  test("«Нет» → taken now: the bill opens only after it is saved", async () => {
    repo.duesToConfirm.mockResolvedValue([]);
    await mount();
    repo.duesToConfirm.mockResolvedValueOnce([due()]).mockResolvedValue([]);
    const bill = await endedSeat(7);
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-no")); });
    expect(bill).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-save")); });
    expect(repo.confirmDue).toHaveBeenCalledWith(7, { payment_method: "cash" });
    expect(bill).toHaveBeenCalledTimes(1);
  });

  test("«Позже»: the bill opens; the seat is asked about again later", async () => {
    repo.duesToConfirm.mockResolvedValue([due()]);
    await mount();
    const bill = await endedSeat(7);
    expect(bill).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId("due-confirm-later")); });
    expect(bill).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("due-confirm")).toBeNull();
  });

  test("nothing to confirm for that seat: the bill opens at once, no window", async () => {
    repo.duesToConfirm.mockResolvedValue([]);
    await mount();
    const bill = await endedSeat(7);
    expect(bill).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("due-confirm")).toBeNull();
  });

  test("the list cannot be read: the bill still opens", async () => {
    repo.duesToConfirm.mockResolvedValue([]);
    await mount();
    repo.duesToConfirm.mockRejectedValue(new Error("offline"));
    const bill = await endedSeat(7);
    expect(bill).toHaveBeenCalledTimes(1);
  });

  test("a poll sent before the seat ended, answering late, does not drop the question", async () => {
    let lateAnswer: (v: IDueToConfirm[]) => void = () => {};
    repo.duesToConfirm.mockResolvedValueOnce([]);
    await mount();
    // The poll: sent now, answered (empty) only after the seat's own read.
    repo.duesToConfirm.mockImplementationOnce(() => new Promise<IDueToConfirm[]>((r) => { lateAnswer = r; }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    repo.duesToConfirm.mockResolvedValueOnce([due()]);
    const bill = await endedSeat(7);
    expect(screen.getByTestId("due-confirm")).toBeTruthy();
    await act(async () => { lateAnswer([]); await Promise.resolve(); });
    expect(screen.getByTestId("due-confirm")).toBeTruthy();
    expect(bill).not.toHaveBeenCalled();
  });

  test("not an owner or manager: nobody asks, the bill opens at once", async () => {
    auth.role = "admin";
    await mount();
    const bill = vi.fn();
    afterDueConfirmed(7, bill);
    expect(bill).toHaveBeenCalledTimes(1);
  });
});
