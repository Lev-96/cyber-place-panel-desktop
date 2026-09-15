// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IBillBreakdown } from "@/api/sessions";
import { ISessionApi } from "@/types/sessions";
import StopReceiptModal from "./StopReceiptModal";

/**
 * What the closing receipt is allowed to say about money.
 *
 * A waived session used to print the venue's rate and the arithmetic the clock
 * would have earned — "1 000/h", "17.22" — directly above the words "Free
 * session". Two numbers and a word, only one of which the player is being
 * handed, and a cashier reading the receipt had to work out which.
 *
 * So on a waived bill the rate and the time cost are gone. What stays is the
 * time played, because how long the seat ran is a fact about the seat rather
 * than a charge, and the total, which says the words.
 *
 * The flag is `is_free` and nothing else. `total === 0` is equally true of a
 * paying session stopped in its first seconds, and deciding this from the
 * figure would waive that one on screen.
 */

const repo = vi.hoisted(() => ({ preview: vi.fn(), stop: vi.fn(), removeItem: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    preview: (...a: unknown[]) => repo.preview(...a),
    stop: (...a: unknown[]) => repo.stop(...a),
    removeItem: (...a: unknown[]) => repo.removeItem(...a),
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => k,
    // Distinctive enough that a match cannot come from anywhere else on
    // screen, and it HONOURS the precision options it is handed.
    //
    // It used to discard them, which meant every figure on the receipt looked
    // identical to this suite whether the component asked for cents or not —
    // so the defect where a joystick line rounded to whole units under a total
    // that printed cents was invisible here. A mock that drops the argument
    // under test proves nothing about it.
    money: (n: number, opts?: { maximumFractionDigits?: number }) =>
      opts?.maximumFractionDigits === 2
        ? `${Number(n).toFixed(2)}·AMD`
        : `${Math.round(Number(n))}·AMD`,
  }),
}));

const bill = (over: Partial<IBillBreakdown> = {}): IBillBreakdown => ({
  mode: "open",
  is_free: false,
  is_unlimited: true,
  elapsed_minutes: 1,
  time_cost: 17.22,
  hourly_rate: 1000,
  package_name: null,
  items: [],
  items_total: 0,
  joysticks: [],
  joysticks_total: 0,
  subtotal: 17.22,
  gross_total: 17.22,
  total: 17.22,
  ...over,
} as IBillBreakdown);

const session = (over: Partial<ISessionApi> = {}): ISessionApi =>
  ({ id: 1, pc_id: 8, pc_label: "PS4-08", status: "active", ...over }) as ISessionApi;

const mount = async (s: ISessionApi = session()) => {
  await act(async () => {
    render(
      <StopReceiptModal
        session={s}
        onClose={() => {}}
        onConfirmed={() => {}}
        onItemRemoved={() => {}}
      />,
    );
  });
};

/**
 * How the money was taken.
 *
 * ⚠️ These check the DIALOG's half of the contract only. The server enforces
 * the same rule and is what actually decides — a stop refused for a missing
 * note leaves the seat running, which is the outcome that matters and is
 * pinned on the backend. What is asserted here is that a cashier is told
 * before the request, and that the payload carries what they chose.
 */
describe("the payment method", () => {
  // By VALUE, not by label text: the labels and the placeholder share a prefix
  // and a text query matches more than one of them.
  const radio = (value: string) =>
    screen
      .getAllByRole("radio")
      .find((r) => (r as HTMLInputElement).value === value) as HTMLInputElement;

  const confirm = () => screen.getByRole("button", { name: "session.confirmStop" });

  // ⚠️ Its own cleanup: the file's other describe has one, and without this
  // the modals stack up and every query finds two of everything.
  afterEach(cleanup);

  beforeEach(() => {
    repo.preview.mockReset();
    repo.stop.mockReset();
    repo.preview.mockResolvedValue(bill());
    repo.stop.mockResolvedValue({ session: session(), breakdown: bill() });
  });

  test("cash is chosen by default, so the ordinary stop stays one click", async () => {
    await mount();

    expect(radio("cash").checked).toBe(true);
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.stop).toHaveBeenCalledWith(1, { payment_method: "cash" });
  });

  test("card sends card and no free text", async () => {
    await mount();

    await act(async () => { fireEvent.click(radio("card")); });
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.stop).toHaveBeenCalledWith(1, { payment_method: "card" });
  });

  test("the free-text field appears only for another method", async () => {
    await mount();

    expect(screen.queryByPlaceholderText("session.payOtherPlaceholder")).toBeNull();

    await act(async () => { fireEvent.click(radio("other")); });
    expect(screen.getByPlaceholderText("session.payOtherPlaceholder")).toBeTruthy();

    // …and goes again when the cashier changes their mind.
    await act(async () => { fireEvent.click(radio("cash")); });
    expect(screen.queryByPlaceholderText("session.payOtherPlaceholder")).toBeNull();
  });

  test("another method with nothing typed does not reach the server", async () => {
    await mount();

    await act(async () => { fireEvent.click(radio("other")); });
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.stop).not.toHaveBeenCalled();
    expect(screen.getByText("session.payOtherRequired")).toBeTruthy();
  });

  test("whitespace is not a method name", async () => {
    await mount();

    await act(async () => { fireEvent.click(radio("other")); });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("session.payOtherPlaceholder"), {
        target: { value: "   " },
      });
    });
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.stop).not.toHaveBeenCalled();
  });

  test("what the cashier typed is what is sent, trimmed", async () => {
    await mount();

    await act(async () => { fireEvent.click(radio("other")); });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("session.payOtherPlaceholder"), {
        target: { value: "  Idram " },
      });
    });
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.stop).toHaveBeenCalledWith(1, {
      payment_method: "other",
      payment_method_other: "Idram",
    });
  });

  test("choosing cash after typing a note drops the note", async () => {
    // The field can hold text typed before the cashier changed their mind.
    // It must not travel with a cash payment.
    await mount();

    await act(async () => { fireEvent.click(radio("other")); });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("session.payOtherPlaceholder"), {
        target: { value: "Idram" },
      });
    });
    await act(async () => { fireEvent.click(radio("cash")); });
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.stop).toHaveBeenCalledWith(1, { payment_method: "cash" });
  });
});

describe("StopReceiptModal", () => {
  beforeEach(() => {
    repo.preview.mockReset();
    repo.stop.mockReset();
  });
  afterEach(cleanup);

  test("a waived bill quotes no rate and no time cost", async () => {
    repo.preview.mockResolvedValue(bill({ is_free: true, total: 0 }));
    await mount();

    // Kept: the seat, the time played, the words.
    expect(screen.getByText(/PS4-08/)).toBeTruthy();
    expect(screen.getByText(/session\.timePlayed/)).toBeTruthy();
    expect(screen.getByText("session.totalDue")).toBeTruthy();
    expect(screen.getByText("session.freeBill")).toBeTruthy();

    // Gone: the rate, the arithmetic, and the "waived" line under the total.
    expect(screen.queryByText(/1000\.00·AMD/)).toBeNull();
    expect(screen.queryByText(/17\.22·AMD/)).toBeNull();
    expect(screen.queryByText(/session\.freeBillWaived/)).toBeNull();
  });

  test("an ordinary bill still quotes both", async () => {
    repo.preview.mockResolvedValue(bill());
    await mount();

    expect(screen.getByText(/1000\.00·AMD/)).toBeTruthy();
    // Twice: once as the time cost, once as the total.
    expect(screen.getAllByText(/17\.22·AMD/).length).toBe(2);
    expect(screen.queryByText("session.freeBill")).toBeNull();
  });

  /**
   * The case that makes `is_free` the right flag and `total === 0` the wrong
   * one: a paying session stopped in its first seconds owes nothing yet, and
   * must still show the rate it is running at.
   */
  test("a paying session that has earned nothing yet is not treated as waived", async () => {
    repo.preview.mockResolvedValue(bill({ time_cost: 0, subtotal: 0, gross_total: 0, total: 0 }));
    await mount();

    // No figure on THIS receipt has cents, so none of them prints any. The
    // precision is one decision for the whole bill, not one per number.
    expect(screen.getByText(/\b1000·AMD/)).toBeTruthy();
    expect(screen.queryByText("session.freeBill")).toBeNull();
  });

  /**
   * Pads on the receipt.
   *
   * A joystick's price is a FLAT FEE per use, owed once the pad has been out
   * ten minutes and not owed at all below that. So a line is the whole fee or
   * a plain 0 — never a fraction — and the 0 has to explain itself, or a
   * cashier reads it as a charge the till lost.
   *
   * Every figure comes from the server. Nothing here multiplies a price by a
   * duration, which is the arithmetic this pricing rule exists to refuse.
   */
  describe("joystick lines", () => {
    const pads = [
      { id: 1, slot: 2, price: 500, started_at: "2026-09-09T14:00:00Z",
        stopped_at: "2026-09-09T14:20:00Z", is_open: false, minutes: 20, seconds: 1200,
        amount: 500, is_charged: true },
      { id: 2, slot: 3, price: 700, started_at: "2026-09-09T14:10:00Z",
        stopped_at: "2026-09-09T14:18:00Z", is_open: false, minutes: 8, seconds: 480,
        amount: 0, is_charged: false },
    ];

    test("a charged pad shows its whole fee, never a fraction of it", async () => {
      repo.preview.mockResolvedValue(bill({ joysticks: pads, joysticks_total: 500, total: 517.22 }));
      await mount();

      // The stub `t` returns the bare key, so both pads carry the same label.
      expect(screen.getAllByText("session.joystickSlot").length).toBe(2);
      expect(screen.getByText("500.00·AMD")).toBeTruthy();
      // Twenty minutes of a 500 rate would be 166.67. There is no rate.
      expect(screen.queryByText(/166/)).toBeNull();
    });

    test("a pad under the threshold shows 0 and says why", async () => {
      repo.preview.mockResolvedValue(bill({ joysticks: pads, joysticks_total: 500, total: 517.22 }));
      await mount();

      expect(screen.getByText("0.00·AMD")).toBeTruthy();
      expect(screen.getByText(/session\.joystickReturned/)).toBeTruthy();
    });

    test("a waived bill quotes no pad charges either", async () => {
      repo.preview.mockResolvedValue(bill({ is_free: true, joysticks: pads, total: 0 }));
      await mount();

      // The seat owes nothing, and a fee printed beside "Free session" is the
      // same two-numbers-one-truth problem the rate and time cost had.
      expect(screen.queryByText("500.00·AMD")).toBeNull();
      expect(screen.getByText("session.freeBill")).toBeTruthy();
    });
  });

  /**
   * A seat whose paid period ran out is ended by the server, and the receipt
   * that opens for it reports rather than asks.
   *
   * Offering "Confirm stop" on a session that is already over would be a button
   * that can only fail, and the per-line remove would be an edit to a bill that
   * has been banked.
   */
  describe("a seat that ended without anybody pressing Stop", () => {
    test("reports the final bill instead of offering to stop it", async () => {
      repo.preview.mockResolvedValue(bill({ total: 250 }));
      await mount(session({ status: "expired" }));

      expect(screen.getByText("session.checkoutDone")).toBeTruthy();
      expect(screen.getByText("action.close")).toBeTruthy();
      expect(screen.queryByText("session.confirmStop")).toBeNull();
      expect(screen.getByText("250.00·AMD")).toBeTruthy();
    });

    /**
     * The precision is decided from EVERY figure, not from the clock.
     *
     * A whole hour of seat and a fractional pad: reading the decision off the
     * time cost alone would print "1000", "0" and "1000.69" — the line that
     * carries the cents being the only one that hides them.
     */
    test("a fractional pad alone is enough to put cents on the whole receipt", async () => {
      repo.preview.mockResolvedValue(bill({
        time_cost: 1000,
        joysticks: [{
          id: 1, slot: 3, price: 500, started_at: "2026-09-15T14:00:00Z", stopped_at: null,
          is_open: true, minutes: 0, seconds: 5, amount: 0.69, is_charged: true, is_hourly: true,
        }],
        joysticks_total: 0.69,
        subtotal: 1000.69,
        gross_total: 1000.69,
        total: 1000.69,
      }));
      await mount();

      expect(screen.getByText("0.69·AMD")).toBeTruthy();
      expect(screen.getByText("1000.00·AMD")).toBeTruthy();
      expect(screen.getByText("1000.69·AMD")).toBeTruthy();
      // The figure a clock-only decision would have printed for the pad.
      expect(screen.queryByText("1·AMD")).toBeNull();
    });

    /**
     * The other direction of the same defect, found by driving the real panel.
     *
     * A fee-strategy bill of 4.72 of clock and 500 of pad printed "4.72", "500"
     * and "505": the first figure is under the per-figure threshold and the
     * other two are over it, so the column stopped adding up at the opposite
     * end from the case below. The precision is one decision for the receipt.
     */
    test("a whole-unit pad beside a fractional clock still adds up", async () => {
      repo.preview.mockResolvedValue(bill({
        time_cost: 4.72,
        joysticks: [{
          id: 1, slot: 3, price: 500, started_at: "2026-09-15T14:00:00Z", stopped_at: null,
          is_open: true, minutes: 0, seconds: 7, amount: 500, is_charged: true, is_hourly: false,
        }],
        joysticks_total: 500,
        subtotal: 504.72,
        gross_total: 504.72,
        total: 504.72,
      }));
      await mount();

      expect(screen.getByText("4.72·AMD")).toBeTruthy();
      expect(screen.getByText("500.00·AMD")).toBeTruthy();
      expect(screen.getByText("504.72·AMD")).toBeTruthy();
      // What it used to print for the total while the pad line said "500".
      expect(screen.queryByText("505·AMD")).toBeNull();
    });

    /**
     * The receipt has ONE rounding rule, and the lines add up to the total.
     *
     * The reported defect: a bill of 21.94 of clock and 1.11 of pad printed as
     * "21.94", "1" and "23.05" — three figures a cashier cannot reconcile,
     * because the pad line rounded to whole units while the time cost and the
     * total printed cents. Under the hourly strategy a pad's share of a short
     * session is a fraction as a matter of course, so this was every receipt,
     * not an edge case.
     */
    test("a fractional pad line prints the same precision as the total above it", async () => {
      repo.preview.mockResolvedValue(bill({
        time_cost: 21.94,
        joysticks: [{
          id: 1, slot: 3, price: 50, started_at: "2026-09-15T14:00:00Z", stopped_at: null,
          is_open: true, minutes: 1, seconds: 80, amount: 1.11, is_charged: true, is_hourly: true,
        }],
        joysticks_total: 1.11,
        subtotal: 23.05,
        gross_total: 23.05,
        total: 23.05,
      }));
      await mount();

      expect(screen.getByText("21.94·AMD")).toBeTruthy();
      expect(screen.getByText("1.11·AMD")).toBeTruthy();
      expect(screen.getByText("23.05·AMD")).toBeTruthy();
      // The figure that used to be there instead of 1.11.
      expect(screen.queryByText("1·AMD")).toBeNull();
    });

    test("its lines cannot be edited any more", async () => {
      repo.preview.mockResolvedValue(bill({
        items: [{ id: 7, name: "Coca-Cola", price: 300, qty: 1, line_total: 300 }],
      }) as IBillBreakdown);
      await mount(session({ status: "expired" }));

      expect(screen.getByText("Coca-Cola")).toBeTruthy();
      // The × on a line is what removes it; a banked bill has none.
      expect(screen.queryByTitle("session.removeItemTitle")).toBeNull();
    });

    test("a running seat still offers the checkout", async () => {
      repo.preview.mockResolvedValue(bill());
      await mount();

      expect(screen.getByText("session.confirmStop")).toBeTruthy();
      expect(screen.queryByText("session.checkoutDone")).toBeNull();
    });
  });
});
