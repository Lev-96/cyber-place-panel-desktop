import type { PaymentMethod } from "@/api/sessions";
import { toAmount } from "@/shifts/cash";

/**
 * How a bill was paid (2026-11-07, owner): one method, or SPLIT across
 * several — part card, part cash, part other — with a note saying how. One
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
}

export interface PaymentDraft {
  split: boolean;
  /** The one method when not split. */
  method: PaymentMethod;
  /** Not split: what "other" was. Split: how it was paid ("3000 картой, 2000 наличными"). */
  note: string;
  /** Split: what was typed per method (empty = not this method). */
  amounts: Record<PaymentMethod, string>;
}

export const emptyPaymentDraft = (method: PaymentMethod = "cash"): PaymentDraft => ({
  split: false, method, note: "", amounts: { cash: "", card: "", other: "" },
});

export type PaymentProblem =
  /** A part is not an amount (letters, three decimals, a minus). */
  | "invalid"
  /** Split, but fewer than two parts above zero. */
  | "parts"
  /** The parts do not add up to the bill. */
  | "sum"
  /** The note is required (split, or the single "other"). */
  | "note";

export interface PaymentCheck {
  ok: boolean;
  problem: PaymentProblem | null;
  /** The parts above zero, in method order. Empty when not split. */
  lines: PaymentLine[];
  /** Bill minus the parts typed so far, in cents (negative = too much). Split only. */
  remainingCents: number;
}

const NOTE_MAX = 255;

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
    const noteMissing = d.method === "other" && d.note.trim() === "";
    return { ok: !noteMissing, problem: noteMissing ? "note" : null, lines: [], remainingCents: 0 };
  }
  const lines: PaymentLine[] = [];
  let sum = 0;
  for (const method of SPLIT_METHODS) {
    const raw = d.amounts[method].trim();
    if (raw === "") continue;
    const cents = partCents(raw);
    if (cents === null) return { ok: false, problem: "invalid", lines: [], remainingCents: dueCents - sum };
    if (cents === 0) continue;
    sum += cents;
    lines.push({ method, amount: cents / 100 });
  }
  const remainingCents = dueCents - sum;
  const problem: PaymentProblem | null =
    lines.length < 2 ? "parts" : remainingCents !== 0 ? "sum" : d.note.trim() === "" ? "note" : null;
  return { ok: problem === null, problem, lines, remainingCents };
};

/**
 * The body the server takes. Not split: the fields every server has always
 * taken (`payment_method`, `payment_method_other`), so nothing changes for a
 * one-method payment. Split: `payments` (each part) and `payment_note`.
 */
export const paymentBody = (d: PaymentDraft, check: PaymentCheck):
  | { payment_method: PaymentMethod; payment_method_other?: string }
  | { payments: PaymentLine[]; payment_note: string } =>
  d.split
    ? { payments: check.lines, payment_note: d.note.trim().slice(0, NOTE_MAX) }
    : { payment_method: d.method, ...(d.method === "other" ? { payment_method_other: d.note.trim() } : {}) };

/** "Остаток сюда": the method's box filled with what is still due (never below 0). */
export const fillRemaining = (dueCents: number, d: PaymentDraft, method: PaymentMethod): PaymentDraft => {
  const others = SPLIT_METHODS.filter((m) => m !== method).reduce((sum, m) => sum + (partCents(d.amounts[m]) ?? 0), 0);
  const rest = Math.max(0, dueCents - others);
  return { ...d, amounts: { ...d.amounts, [method]: rest === 0 ? "" : toAmount(rest) } };
};
