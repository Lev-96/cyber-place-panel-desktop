/**
 * The order of the two windows after a seat ends by itself (2026-11-20,
 * owner): «Эти товары оплатили?» FIRST, then the final bill.
 *
 * The board (which opens the bill) and `DueConfirmNotifier` (which asks the
 * question, app-wide) know nothing of each other; this is the one seam
 * between them. The notifier registers how it asks about a seat; the board
 * hands it the seat that just ended and opens the bill when it answers —
 * after «Да»/«Нет» and the way of paying, after «Позже», or at once when
 * that seat has nothing to confirm.
 *
 * With nobody registered (not an owner or manager, or not mounted) the bill
 * opens at once, synchronously — exactly as before this seam existed.
 */
/**
 * How that seat's question ended (2026-11-20, owner): «Да, оплатили»
 * (`paid` — the player had paid it during play), «Нет, принять оплату»
 * (`taken` — taken now), or not answered (`null`: nothing to confirm, «Позже»,
 * not readable). The bill shows «Доплатить» unless it was `paid`.
 */
export type DueAnswer = "paid" | "taken" | null;

export type DueAsker = (sessionId: number) => Promise<DueAnswer>;

let asker: DueAsker | null = null;

/** The notifier says how it asks; the returned function takes that back. */
export const registerDueAsker = (fn: DueAsker): (() => void) => {
  asker = fn;
  return () => {
    if (asker === fn) asker = null;
  };
};

/**
 * Run `then` once this ended seat's due (if any) is answered. Never throws
 * and never swallows `then`: a failed read still opens the bill.
 */
export const afterDueConfirmed = (sessionId: number, then: (answer: DueAnswer) => void): void => {
  if (asker === null) {
    then(null);
    return;
  }
  let done = false;
  const once = (answer: DueAnswer) => {
    if (done) return;
    done = true;
    then(answer);
  };
  try {
    asker(sessionId).then((answer) => once(answer ?? null), () => once(null));
  } catch {
    once(null);
  }
};
