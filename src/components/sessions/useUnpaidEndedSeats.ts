import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { ISessionApi } from "@/types/sessions";

/** How far back the board looks for an ended seat nobody settled. */
export const UNPAID_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** One look on mount, then one a minute: the board's own reads come every 30 s. */
export const UNPAID_SCAN_INTERVAL_MS = 60_000;
/** One page of the history list is plenty for a day of one branch. */
export const UNPAID_SCAN_LIMIT = 200;

/**
 * An ended seat that still owes its way of paying (2026-11-18, owner: every
 * payment carries its method). Ended by the clock or the kiosk while no board
 * was open, so nobody was asked: no method and no parts on record, not
 * cancelled, not waived, and something was billed. Every figure is the
 * server's; this only reads the row's own flags.
 */
export const isUnpaidEndedSeat = (s: ISessionApi): boolean =>
  (s.status === "expired" || s.status === "stopped")
  && (s.payment_method ?? null) === null
  && (s.payments?.length ?? 0) === 0
  && s.is_free !== true
  && !s.cancelled_at
  && Number(s.total_paid) > 0;

/**
 * Seats that ended while no board was open (2026-11-18, owner).
 *
 * On mount, then once a minute (its own timer, so no board read can turn it
 * into a storm: one GET a minute against the 300/min budget), reads the
 * branch's last 24 h of sessions and queues those that ended unpaid
 * (`isUnpaidEndedSeat`). Each is opened in turn as the board's receipt — the
 * same mandatory one a seat expiring under the cashier's eyes gets — and never
 * over a receipt already open (`current ?? next`).
 *
 * The queue is a fresh server read each time, so a seat settled at another
 * desk drops out by itself. A seat this board settled (`settle`) — recorded,
 * or refused for good — is never queued again while the board is mounted.
 *
 * ⚠️ The history list is scoped by the server: a manager only sees the closed
 * seats they opened, so only those are asked about here.
 */
export const useUnpaidEndedSeats = (
  branchId: number,
  openReceipt: ISessionApi | null,
  setReceipt: Dispatch<SetStateAction<ISessionApi | null>>,
): { settle: (sessionId: number) => void } => {
  const [queue, setQueue] = useState<ISessionApi[]>([]);
  const settledRef = useRef<Set<number>>(new Set());
  const openIdRef = useRef<number | null>(null);
  openIdRef.current = openReceipt?.id ?? null;

  useEffect(() => {
    settledRef.current = new Set();
    setQueue([]);
    let alive = true;
    let inFlight = false;
    const scan = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const list = await sessionRepository.list({
          branch_id: branchId,
          from: new Date(Date.now() - UNPAID_LOOKBACK_MS).toISOString(),
          limit: UNPAID_SCAN_LIMIT,
        });
        if (!alive) return;
        // A fresh read each time: a seat settled at another desk drops out.
        setQueue(list.filter((s) =>
          s.branch_id === branchId
          && isUnpaidEndedSeat(s)
          && !settledRef.current.has(s.id)
          && s.id !== openIdRef.current));
      } catch {
        // A failed look asks nothing; the next one (a minute on) tries again.
      } finally {
        inFlight = false;
      }
    };
    void scan();
    const timer = setInterval(() => { void scan(); }, UNPAID_SCAN_INTERVAL_MS);
    // Another branch is another list: start over.
    return () => { alive = false; clearInterval(timer); };
  }, [branchId]);

  // One at a time, and only when no receipt is open.
  useEffect(() => {
    if (openReceipt !== null || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    if (settledRef.current.has(next.id)) return;
    // Never over an open receipt; one lost to a race is found again next scan.
    setReceipt((current) => current ?? next);
  }, [openReceipt, queue, setReceipt]);

  const settle = useCallback((sessionId: number) => {
    settledRef.current.add(sessionId);
    setQueue((q) => q.filter((s) => s.id !== sessionId));
  }, []);

  return { settle };
};
