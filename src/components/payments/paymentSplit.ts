import type { PaymentMethod } from "@/api/sessions";
import { toAmount } from "@/shifts/cash";

/**
 * How a bill was paid (2026-11-07, owner): one method, or SPLIT across
 * several — part card, part cash, part other — with an optional note saying
 * how (2026-11-15, owner: no words are ever required, a split's note and an
 * «Другое»'s text alike). One
 * model for every screen that closes a bill (a seat's stop, a seat that ended
 * by itself, a sale at the till), so they can never disagree. Money in whole
 * cents: no float ever touches a sum. The server checks every rule again and
 * is what decides.
 */

/** The methods a split may use; `deposit` (a member's balance) is never split. */
export const SPLIT_METHODS: readonly PaymentMethod[] = ["cash", "card", "other"];

export interface PaymentLine {
  method: PaymentMethod;
  /** Money, 2 decimals, as the server takes it. */
  amount: number;
  /** «Свой вариант» (2026-11-18): the name of the `other` part, when given. */
  label?: string;
}

/** The longest name of a «Свой вариант» (the server's `PaymentMethod::LABEL_MAX`). */
export const OWN_LABEL_MAX = 64;

export interface PaymentDraft {
  split: boolean;
  /**
   * The one method when not split. `null`: nothing chosen yet (2026-11-18,
   * owner: a seat's receipt preselects no method, the cashier must pick one).
   * Only the receipt starts there; the till, Start and «+ Время» start on cash.
   */
  method: PaymentMethod | null;
  /** Optional. Not split: what "other" was. Split: how it was paid ("3000 картой, 2000 наличными"). */
  note: string;
  /** Split: what was typed per method (empty = not this method). */
  amounts: Record<PaymentMethod, string>;
  /**
   * Split: «+ Свой вариант» pressed (2026-11-18, owner) — the `other` part is
   * offered only then, under the name typed on its left (Idram, «Hovo Card»).
   */
  own?: { shown: boolean; label: string };
}

export const emptyPaymentDraft = (method: PaymentMethod | null = "cash"): PaymentDraft => ({
  split: false, method, note: "", amounts: { cash: "", card: "", other: "" }, own: { shown: false, label: "" },
});

export type PaymentProblem =
  /** Not split, and no method chosen yet (2026-11-18). */
  | "method"
  /** A part is not an amount (letters, three decimals, a minus). */
  | "invalid"
  /** Split, but no part above zero typed yet. */
  | "parts"
  /** The parts do not add up to the bill. */
  | "sum";

export interface PaymentCheck {
  ok: boolean;
  problem: PaymentProblem | null;
  /** The parts above zero, in method order. Empty when not split. */
  lines: PaymentLine[];
  /** Bill minus the parts typed so far, in cents (negative = too much). Split only. */
  remainingCents: number;
}

const NOTE_MAX = 255;
/** The row's `payment_method_other` column: the text of a single «Другое». */
const OTHER_TEXT_MAX = 120;

/**
 * A part as cents. `PriceInput` hands over AMD, and from another display
 * currency that can carry more than two decimals: a number is rounded to the
 * cent, anything else is not an amount.
 */
const partCents = (raw: string): number | null => {
  const s = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
};

/** The draft read against the bill: what it would send, or why it cannot. */
export const checkPayment = (dueCents: number, d: PaymentDraft): PaymentCheck => {
  if (!d.split) {
    return d.method === null
      ? { ok: false, problem: "method", lines: [], remainingCents: dueCents }
      : { ok: true, problem: null, lines: [], remainingCents: 0 };
  }
  const lines: PaymentLine[] = [];
  let sum = 0;
  for (const method of SPLIT_METHODS) {
    // The `other` part exists only once «+ Свой вариант» is pressed.
    if (method === "other" && d.own !== undefined && !d.own.shown) continue;
    const raw = d.amounts[method].trim();
    if (raw === "") continue;
    const cents = partCents(raw);
    if (cents === null) return { ok: false, problem: "invalid", lines: [], remainingCents: dueCents - sum };
    if (cents === 0) continue;
    sum += cents;
    const label = method === "other" ? ownLabel(d) : "";
    lines.push(label === "" ? { method, amount: cents / 100 } : { method, amount: cents / 100, label });
  }
  const remainingCents = dueCents - sum;
  const problem: PaymentProblem | null =
    lines.length === 0 ? "parts" : remainingCents !== 0 ? "sum" : null;
  return { ok: problem === null, problem, lines, remainingCents };
};

/** The «Свой вариант» name as sent: trimmed, at most {@link OWN_LABEL_MAX}. */
const ownLabel = (d: PaymentDraft): string => (d.own?.shown ? d.own.label.trim().slice(0, OWN_LABEL_MAX) : "");

/** One method, as every server has always taken it; the «Другое» text only when typed. */
const singleBody = (method: PaymentMethod, text: string): { payment_method: PaymentMethod; payment_method_other?: string } => {
  const typed = method === "other" ? text.trim().slice(0, OTHER_TEXT_MAX) : "";
  return typed === "" ? { payment_method: method } : { payment_method: method, payment_method_other: typed };
};

/**
 * The body the server takes. One method — or a split with exactly ONE part
 * above zero (2026-11-15, owner) — sends the fields every server has always
 * taken (`payment_method`, `payment_method_other` only when words were
 * typed). Two or more parts: `payments`, and `payment_note` only when written.
 */
export const paymentBody = (d: PaymentDraft, check: PaymentCheck):
  | { payment_method: PaymentMethod; payment_method_other?: string }
  | { payments: PaymentLine[]; payment_note?: string } => {
  if (!d.split) {
    // Never a request without a method (2026-11-18): every caller gates on
    // `check.ok` first, so this only fires on a caller that forgot to.
    if (d.method === null) throw new Error("paymentBody: no payment method chosen");
    return singleBody(d.method, d.note);
  }
  // One part left: as a single method; a lone «Свой вариант» sends its name
  // as the «Другое» text, which the server keeps as the name.
  if (check.lines.length === 1) return singleBody(check.lines[0].method, check.lines[0].label ?? d.note);
  const note = d.note.trim().slice(0, NOTE_MAX);
  return note === "" ? { payments: check.lines } : { payments: check.lines, payment_note: note };
};

/**
 * How a sum paid AHEAD was paid (2026-11-17, owner: the Stop methods at Start
 * and in «+ Время» too) — the body {@link paymentBody} sends, except that plain
 * cash sends NOTHING: every server has always read no method as cash, so a
 * cash prepayment leaves the request byte for byte as it was.
 */
export const prepaidPaymentFields = (d: PaymentDraft, check: PaymentCheck):
  | Record<string, never>
  | ReturnType<typeof paymentBody> => {
  const body = paymentBody(d, check);
  return "payment_method" in body && body.payment_method === "cash" && body.payment_method_other === undefined ? {} : body;
};

/** "Остаток сюда": the method's box filled with what is still due (never below 0). */
export const fillRemaining = (dueCents: number, d: PaymentDraft, method: PaymentMethod): PaymentDraft => {
  const others = SPLIT_METHODS.filter((m) => m !== method && !(m === "other" && d.own !== undefined && !d.own.shown))
    .reduce((sum, m) => sum + (partCents(d.amounts[m]) ?? 0), 0);
  const rest = Math.max(0, dueCents - others);
  return { ...d, amounts: { ...d.amounts, [method]: rest === 0 ? "" : toAmount(rest) } };
};
