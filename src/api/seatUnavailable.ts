import type { ApiError } from "@/api/client";

/**
 * Turns "this seat is spoken for" into something the cashier can act on.
 *
 * The server refuses a grant or an unlimited switch with a stable `code` and,
 * when there is one, the moment the seat is claimed — see
 * `App\Exceptions\Sessions\SeatUnavailableException`. Without reading it the
 * panel can only print the sentence and let the cashier retry by guessing: 30
 * refused, then 20, then 10.
 *
 * Shaped after `blockingErrors.ts`, and for the same reasons — the code rather
 * than the sentence, so the panel words it in the operator's own language, and
 * the server's text kept as the fallback so a newer backend still reads as
 * something.
 *
 * ⚠️ `maxMinutes` is ADVICE. It was true when the server refused and a phone
 * can take the seat a second later; the guard inside the locked transaction is
 * what decides. Offering it as a button is right; treating it as a promise is
 * not, which is why the button submits a normal request and can be refused
 * again.
 */

export interface SeatUnavailableBody {
  message?: string;
  code?: string;
  /** ISO instant the next reservation starts, or null when there is none. */
  latest_allowed_end?: string | null;
  /** Whole minutes from the session's current end to that instant. */
  max_minutes?: number | null;
}

/** Codes this panel has wording for. */
const KNOWN = new Set(["seat_reserved", "seat_reserved_unlimited"]);

/** The refusal body of a failed request, or null if it was refused for anything else. */
export const seatUnavailableBodyOf = (
  error: unknown,
): SeatUnavailableBody | null => {
  const body = (error as ApiError | undefined)?.body;
  if (!body || typeof body !== "object") return null;

  const candidate = body as SeatUnavailableBody;
  return typeof candidate.code === "string" && KNOWN.has(candidate.code)
    ? candidate
    : null;
};

/**
 * The grant the server said it WOULD accept, or null when there is nothing to
 * offer.
 *
 * Zero is null on purpose, not a "+0 minutes" button: a reservation that has
 * already started leaves no headroom at all, and offering a button that grants
 * nothing is worse than offering none.
 */
export const offeredMinutesOf = (body: SeatUnavailableBody | null): number | null => {
  const minutes = body?.max_minutes;
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0
    ? Math.floor(minutes)
    : null;
};

/** The instant the seat is claimed, as a Date, or null. */
export const claimedFromOf = (body: SeatUnavailableBody | null): Date | null => {
  const raw = body?.latest_allowed_end;
  if (typeof raw !== "string") return null;

  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
};
