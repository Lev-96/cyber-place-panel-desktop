/**
 * «Незакрытые счета» (2026-11-22, owner): the one seam between whatever ends
 * or hides a final bill (the sessions board, `StopReceiptModal`) and the
 * app-wide reminder (`OpenBillsNotifier`), which knows nothing of either.
 *
 * Anything that may have changed the list of open bills says so here — a seat
 * ended by itself, a final bill hidden to close later, a payment recorded —
 * and the reminder reads the server's list again at once instead of waiting
 * for its poll. It carries no data: the list is always the server's answer.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** The reminder listens; the returned function stops it. */
export const onOpenBillsChanged = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Something that may change the open bills happened: read them again. Never throws. */
export const openBillsChanged = (): void => {
  for (const fn of [...listeners]) {
    try { fn(); } catch { /* a listener's failure is its own */ }
  }
};
