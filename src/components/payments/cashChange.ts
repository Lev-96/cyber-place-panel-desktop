import { parseCents } from "@/shifts/cash";

/**
 * The change for a place paid in cash (2026-10-19), in whole cents so no
 * float ever touches the subtraction. A courtesy for the cashier: the server
 * checks the same rule against the bill at the instant of the stop and is
 * what decides. The bill is never the banknotes — the change goes back.
 *
 * - empty   nothing typed yet: no change is shown, the stop is today's stop.
 * - invalid not an amount (letters, a minus, three decimals, > 99 999 999.99).
 * - short   less than the bill; `missing` is how much more is needed.
 * - ok      enough; `change` is what to hand back (0 for the exact amount).
 */
export type CashChange =
  | { state: "empty" }
  | { state: "invalid" }
  | { state: "short"; receivedCents: number; missingCents: number }
  | { state: "ok"; receivedCents: number; changeCents: number };

/** The server's bill total (2-decimal money) as cents. */
export const billCents = (total: number | string): number => Math.round(Number(total) * 100);

export const cashChange = (dueCents: number, received: string): CashChange => {
  if (received.trim() === "") return { state: "empty" };
  const receivedCents = parseCents(received);
  if (receivedCents === null) return { state: "invalid" };
  return receivedCents < dueCents
    ? { state: "short", receivedCents, missingCents: dueCents - receivedCents }
    : { state: "ok", receivedCents, changeCents: receivedCents - dueCents };
};
