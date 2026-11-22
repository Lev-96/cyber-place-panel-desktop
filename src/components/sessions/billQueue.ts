import type { ISessionApi } from "@/types/sessions";

/**
 * The board's bills, in the order they are shown (2026-11-22, owner).
 *
 * It used to be ONE slot: a second seat that ran out while a bill was open was
 * dropped (`current ?? next`) and its final bill never came back. Now it is a
 * FIFO of seats, one entry per session id: the head is the open bill, closing
 * it opens the next.
 *
 *  - a seat that ended by itself joins the END (after «оплатили?» answered);
 *  - a Stop the cashier pressed goes to the FRONT — it opens at once, as it
 *    always did, and nothing queued is lost; its press instant is kept so the
 *    tile's clock holds there while the preliminary total is open (display
 *    only — the server prices at the receipt's own `priced_at`);
 *  - a seat ended elsewhere while its bill waits keeps its place and becomes
 *    that final bill.
 *
 * Pure functions over an immutable list, so the board's state setter stays a
 * one-liner and every rule is pinned in `billQueue.test.ts`.
 */
export interface BillEntry {
  session: ISessionApi;
  /** When Stop was pressed here (ms); absent for a seat that ended by itself. */
  frozenAt?: number;
}

/** A seat that ended: last in line, unless its bill is already open or waiting. */
export const enqueueBill = (list: readonly BillEntry[], session: ISessionApi): BillEntry[] =>
  list.some((b) => b.session.id === session.id) ? [...list] : [...list, { session }];

/** The cashier pressed Stop: this bill opens NOW, ahead of any waiting. */
export const openBillNow = (list: readonly BillEntry[], session: ISessionApi, pressedAt: number): BillEntry[] =>
  [{ session, frozenAt: pressedAt }, ...list.filter((b) => b.session.id !== session.id)];

/** The bill for this seat was closed or hidden: the next one in line opens. */
export const closeBill = (list: readonly BillEntry[], sessionId: number): BillEntry[] =>
  list.filter((b) => b.session.id !== sessionId);

/**
 * This seat ended somewhere else while its bill was open or waiting: the bill
 * becomes the final one (no confirm, no «stopped» announced as ours). A bill
 * already showing an ended seat is left as it is.
 */
export const markBillEnded = (list: readonly BillEntry[], sessionId: number, status: ISessionApi["status"]): BillEntry[] =>
  list.map((b) => (b.session.id === sessionId && b.session.status === "active"
    ? { ...b, session: { ...b.session, status } }
    : b));
