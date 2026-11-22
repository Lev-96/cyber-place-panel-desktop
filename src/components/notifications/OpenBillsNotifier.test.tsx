// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISessionApi } from "@/types/sessions";

/**
 * «Незакрытые счета» (2026-11-22, owner): the server's list of final bills
 * nobody closed, a banner naming each seat by number and name; a seat opens
 * the same final bill, the payment closes it and it leaves the list. Owners
 * and managers only; read again on a socket frame or the board's signal.
 */
const repo = vi.hoisted(() => ({ openBills: vi.fn(), preview: vi.fn(), recordPayment: vi.fn(), checkout: vi.fn().mockResolvedValue({}), releaseCheckout: vi.fn().mockResolvedValue({}) }));
const auth = vi.hoisted(() => ({ role: "manager", id: 1 }));
const realtime = vi.hoisted(() => ({ handlers: new Map<number, () => void>() }));
vi.mock("@/repositories/SessionRepository", () => ({ sessionRepository: repo }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: auth.id, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}`, lang: "en", currency: "AMD" }),
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
const sound = vi.hoisted(() => ({ playFor: vi.fn() }));
vi.mock("@/sound/soundEngine", () => ({ playFor: (...a: unknown[]) => sound.playFor(...a) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));
vi.mock("@/realtime/useSessionChanged", () => ({
  useSessionChanged: (branchId: number, onChange: () => void) => { realtime.handlers.set(branchId, onChange); },
}));

import { boardOnScreen, JUST_PUT_AWAY_MS, markPutAway, requestOpenBill, setBillShown, useOpenBills } from "./openBillsStore";
import OpenBillsNotifier, { TILL_CHECK_MS, TILL_REMIND_MS } from "./OpenBillsNotifier";
import { openBillsChanged } from "./openBillsSignal";

const ended = (id: number, number: number, name: string | null, over: Partial<ISessionApi> = {}): ISessionApi => ({
  id, branch_id: 7, pc_id: id, pc_label: `PS-${id}`, status: "expired", total_paid: 1000,
  started_at: "2026-11-22T18:00:00+04:00", ends_at: "2026-11-22T19:00:00+04:00", stopped_at: "2026-11-22T19:00:00+04:00",
  payment_method: null, payments: [],
  pc: { id, label: `PS-${id}`, place: { id: 100 + id, number, name } },
  ...over,
} as ISessionApi);

const preview = {
  mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 60, time_cost: 1000, hourly_rate: 1000,
  package_name: "1h", items: [], items_total: 0, joysticks: [], joysticks_total: 0, subtotal: 1000, gross_total: 1000, total: 1000,
};

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
/** Mounted, and its compact chip opened (2026-11-22: the seats are a press away). */
const mount = async () => {
  await act(async () => { render(<OpenBillsNotifier />); });
  await flush();
  const toggle = screen.queryByTestId("open-bills-toggle");
  if (toggle) await act(async () => { fireEvent.click(toggle); });
};

beforeEach(() => {
  auth.role = "manager";
  auth.id = 1;
  realtime.handlers.clear();
  repo.openBills.mockReset().mockResolvedValue([ended(5, 4, "Hall VIP"), ended(6, 7, null)]);
  repo.preview.mockReset().mockResolvedValue(preview);
  repo.recordPayment.mockReset().mockResolvedValue({ session: ended(5, 4, "Hall VIP", { payment_method: "cash" }), cash: null });
});
afterEach(cleanup);

describe("OpenBillsNotifier", () => {
  test("lists each open bill by place number and name, with the count", async () => {
    await mount();
    expect(screen.getByTestId("open-bills-count").textContent).toBe("openBills.chip".replace("{0}", "2"));
    expect(screen.getByTestId("open-bill-5").textContent).toContain("№4 · Hall VIP");
    expect(screen.getByTestId("open-bill-6").textContent).toContain("№7");
    expect(screen.getByTestId("open-bills").className).toContain("dialog-tone--unpaid");
  });

  test("hidden → listed → opened → paid → gone", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("open-bill-5")); });
    await flush();
    // The SAME final bill: the seat in its title, the way of paying asked.
    expect(screen.getByTestId("receipt-seat").textContent).toBe("№4 · Hall VIP");
    expect(screen.getByTestId("pay-mark-note")).toBeTruthy();

    // The server's list after the payment: that seat is closed.
    repo.openBills.mockResolvedValue([ended(6, 7, null)]);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-card")); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-mark-confirm")); });
    await flush();
    expect(repo.recordPayment).toHaveBeenCalledTimes(1);
    expect(repo.recordPayment.mock.calls[0][0]).toBe(5);
    expect(repo.recordPayment.mock.calls[0][1]).toMatchObject({ payment_method: "card" });
    // Gone from the banner at once (the receipt told the reminder).
    expect(screen.queryByTestId("open-bill-5")).toBeNull();
    expect(screen.getByTestId("open-bills-count").textContent).toBe("openBills.chip".replace("{0}", "1"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.close" })); });
    await flush();
    expect(screen.queryByTestId("receipt-seat")).toBeNull();
  });

  test("hiding the reopened bill keeps it on the list", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("open-bill-5")); });
    await flush();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-mark-later")); });
    await flush();
    expect(repo.recordPayment).not.toHaveBeenCalled();
    expect(screen.queryByTestId("receipt-seat")).toBeNull();
    // Still listed: the chip still counts it (its list folds after a pick).
    expect(screen.getByTestId("open-bills-count")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("open-bills-toggle")); });
    expect(screen.getByTestId("open-bill-5")).toBeTruthy();
  });

  test("the board's signal and a session.changed of a listed branch read the list again", async () => {
    repo.openBills.mockResolvedValueOnce([]);
    await mount();
    expect(screen.queryByTestId("open-bills")).toBeNull();
    await act(async () => { openBillsChanged(); });
    await flush();
    expect(screen.getByTestId("open-bills-count")).toBeTruthy();

    repo.openBills.mockResolvedValue([]);
    await act(async () => { realtime.handlers.get(7)?.(); });
    await flush();
    expect(screen.queryByTestId("open-bills")).toBeNull();
  });

  test("an older read landing late never brings back a closed bill", async () => {
    let lateResolve: (v: ISessionApi[]) => void = () => {};
    repo.openBills.mockReset()
      .mockResolvedValueOnce([ended(5, 4, "Hall VIP")])
      .mockReturnValueOnce(new Promise<ISessionApi[]>((r) => { lateResolve = r; }))
      .mockResolvedValueOnce([]);
    await mount();
    await act(async () => { openBillsChanged(); }); // the slow one
    await act(async () => { openBillsChanged(); }); // the newest: empty
    await flush();
    expect(screen.queryByTestId("open-bills")).toBeNull();
    await act(async () => { lateResolve([ended(5, 4, "Hall VIP")]); });
    await flush();
    expect(screen.queryByTestId("open-bills")).toBeNull();
  });

  // QA P2 (2026-11-22): the banner floats over the page bottom, so while it
  // shows the page gets room below its last row; gone with the last bill.
  test("while it shows, the page keeps room for it below the last row", async () => {
    await mount();
    expect(document.documentElement.style.getPropertyValue("--open-bills-h")).toMatch(/^\d+px$/);
    repo.openBills.mockResolvedValue([]);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await flush();
    expect(screen.queryByTestId("open-bills")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--open-bills-h")).toBe("");
  });

  // The seat's tile and the banner (2026-11-22, owner): the sum is shown, the
  // list is shared with the board, and a press on a tile opens that bill here.
  test("shows each bill's sum, shares the list, and opens the bill a tile asks for", async () => {
    let seen: readonly ISessionApi[] = [];
    const Reader = () => { seen = useOpenBills(); return null; };
    await act(async () => { render(<Reader />); });
    await mount();
    expect(seen.map((b) => b.id)).toEqual([5, 6]);
    expect(screen.getByTestId("open-bill-sum-5").textContent).toBe(String(ended(5, 4, "Hall VIP").total_paid));
    expect(screen.queryByTestId("receipt-seat")).toBeNull();
    await act(async () => { requestOpenBill(6); });
    await flush();
    expect(screen.getByTestId("receipt-seat").textContent).toBe("№7");
    // An id not on the list opens nothing.
    cleanup();
    await act(async () => { render(<Reader />); });
    await mount();
    await act(async () => { requestOpenBill(999); });
    expect(screen.queryByTestId("receipt-seat")).toBeNull();
  });

  test("nobody may see them (an admin): the board is told there are none", async () => {
    auth.role = "admin";
    let seen: readonly ISessionApi[] = [ended(1, 1, null)];
    const Reader = () => { seen = useOpenBills(); return null; };
    await act(async () => { render(<Reader />); });
    await mount();
    expect(seen).toEqual([]);
  });

  test("the bill just put away is lit in the banner, then the light goes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      // A light left by an earlier test fades first (the store is the app's).
      markPutAway(0);
      vi.advanceTimersByTime(JUST_PUT_AWAY_MS);
      await mount();
      expect(screen.getByTestId("open-bill-5").className).not.toContain("is-just-put-away");
      await act(async () => { markPutAway(5); });
      expect(screen.getByTestId("open-bill-5").className).toContain("is-just-put-away");
      expect(screen.getByTestId("open-bill-6").className).not.toContain("is-just-put-away");
      await act(async () => { vi.advanceTimersByTime(JUST_PUT_AWAY_MS); });
      expect(screen.getByTestId("open-bill-5").className).not.toContain("is-just-put-away");
    } finally { vi.useRealTimers(); }
  });

  // Compact (2026-11-22, owner): a chip first, the seats on a press; on the
  // sessions board its header shows them, so the chip steps aside.
  test("starts as a closed chip; a press shows the seats", async () => {
    await act(async () => { render(<OpenBillsNotifier />); });
    await flush();
    expect(screen.getByTestId("open-bills-count").textContent).toBe("openBills.chip");
    expect(screen.queryByTestId("open-bill-5")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("open-bills-toggle")); });
    expect(screen.getByTestId("open-bill-5")).toBeTruthy();
  });

  test("with a sessions board on screen the corner chip steps aside", async () => {
    const off = boardOnScreen();
    try {
      await act(async () => { render(<OpenBillsNotifier />); });
      await flush();
      expect(screen.queryByTestId("open-bills")).toBeNull();
    } finally { off(); }
  });

  test("an admin is not asked, and nothing is read", async () => {
    auth.role = "admin";
    await mount();
    expect(repo.openBills).not.toHaveBeenCalled();
    expect(screen.queryByTestId("open-bills")).toBeNull();
  });
});

/**
 * «Свёрнутый счёт ждёт» (2026-11-22, owner): a preliminary total put away is
 * recalled 3 minutes after its Stop (the server's `checkout_at`), then every 3
 * minutes; never while it is on screen; an ended bill is not recalled.
 */
describe("the reminder of a bill put away at the till", () => {
  const T0 = new Date("2026-11-22T15:30:00Z").getTime();
  const atTill = (over: Partial<ISessionApi> = {}) =>
    ended(5, 4, "Hall VIP", { status: "active", checkout_at: new Date(T0).toISOString(), held_total: "500.00", stopped_at: null, ...over });

  beforeEach(() => {
    sound.playFor.mockReset();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "setTimeout"] });
    vi.setSystemTime(T0 + 2 * 60_000);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const tickTo = async (ms: number) => {
    await act(async () => { vi.setSystemTime(T0 + ms); vi.advanceTimersByTime(TILL_CHECK_MS); });
  };

  test("silent at 2 minutes; at 3 it rings and names the seat and its held sum", async () => {
    repo.openBills.mockResolvedValue([atTill()]);
    await mount();
    expect(screen.queryByTestId("till-reminder")).toBeNull();
    await tickTo(TILL_REMIND_MS);
    expect(screen.getByTestId("till-reminder-seat").textContent).toBe("№4 · Hall VIP");
    expect(screen.getByTestId("till-reminder").textContent).toContain("500");
    expect(sound.playFor).toHaveBeenCalledTimes(1);
  });

  test("«Напомнить через 3 мин» waits another three minutes", async () => {
    repo.openBills.mockResolvedValue([atTill()]);
    await mount();
    await tickTo(TILL_REMIND_MS);
    await act(async () => { fireEvent.click(screen.getByTestId("till-reminder-later")); });
    expect(screen.queryByTestId("till-reminder")).toBeNull();
    await tickTo(TILL_REMIND_MS + 2 * 60_000);
    expect(screen.queryByTestId("till-reminder")).toBeNull();
    await tickTo(2 * TILL_REMIND_MS + 30_000);
    expect(screen.getByTestId("till-reminder")).toBeTruthy();
  });

  test("«Открыть счёт» opens that bill and the reminder goes", async () => {
    repo.openBills.mockResolvedValue([atTill()]);
    await mount();
    await tickTo(TILL_REMIND_MS);
    await act(async () => { fireEvent.click(screen.getByTestId("till-reminder-open")); });
    await flush();
    expect(screen.queryByTestId("till-reminder")).toBeNull();
    expect(screen.getByTestId("receipt-seat").textContent).toBe("№4 · Hall VIP");
  });

  test("a bill on screen is not recalled, nor an ended one", async () => {
    repo.openBills.mockResolvedValue([atTill(), ended(6, 7, null)]);
    setBillShown(5, true);
    try {
      await mount();
      await tickTo(TILL_REMIND_MS + 60_000);
      expect(screen.queryByTestId("till-reminder")).toBeNull();
      expect(sound.playFor).not.toHaveBeenCalled();
    } finally { setBillShown(5, false); }
  });
});
