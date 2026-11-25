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

/**
 * The methods with a fixed row in a split. «Свой вариант» parts are rows of
 * their own ({@link OwnPart}), each sent as `other` with its name; `deposit`
 * (a member's balance) is never split.
 */
export const SPLIT_METHODS = ["cash", "card"] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

/**
 * A bill's way of paying: the shared methods, plus a Club Card's bonuses
 * (2026-11-25), which only a bill with a card bound takes (a seat's Stop, a
 * till sale with a card, a prepayment at Start or «+ Время»). Kept apart from
 * `PaymentMethod`, which other screens (change of method, a confirmed due,
 * platform billing) use and which never takes bonuses.
 */
export type BillMethod = PaymentMethod | "bonus";

export interface PaymentLine {
  method: BillMethod;
  /** Money, 2 decimals, as the server takes it. */
  amount: number;
  /** «Свой вариант» (2026-11-18): the name of the `other` part, when given. */
  label?: string;
}

/** The longest name of a «Свой вариант» (the server's `PaymentMethod::LABEL_MAX`). */
export const OWN_LABEL_MAX = 64;

/**
 * At most this many «Свой вариант» rows (2026-11-19): the server takes up to
 * 8 parts in all (`PaymentMethod::MAX_PARTS`), and cash and card may each be
 * one of them.
 */
export const OWN_PARTS_MAX = 6;

/**
 * One «Свой вариант» row of a split (2026-11-19, owner: several in one
 * split, each its own name and amount). `id` is the row's identity on screen
 * only; it is never sent.
 */
export interface OwnPart {
  id: number;
  label: string;
  amount: string;
}

export interface PaymentDraft {
  split: boolean;
  /** The one method when not split. */
  method: BillMethod;
  /** Optional. Not split: what "other" was. Split: how it was paid ("3000 картой, 2000 наличными"). */
  note: string;
  /** Split: what was typed for cash and card (empty = not this method). */
  amounts: Record<SplitMethod, string>;
  /** Split: the «Свой вариант» rows, in the order they were added. */
  own: OwnPart[];
  /** Split: the bonus part (2026-11-25); empty unless a card is bound and the cashier used it. */
  bonus: string;
}

export const emptyPaymentDraft = (method: PaymentMethod = "cash"): PaymentDraft => ({
  split: false, method, note: "", amounts: { cash: "", card: "" }, own: [], bonus: "",
});

export type PaymentProblem =
  /** A part is not an amount (letters, three decimals, a minus). */
  | "invalid"
  /** Two «Свой вариант» rows under one name (case-insensitive), or two unnamed. */
  | "duplicate"
  /** Split, but no part above zero typed yet. */
  | "parts"
  /** The parts do not add up to the bill. */
  | "sum";

export interface PaymentCheck {
  ok: boolean;
  problem: PaymentProblem | null;
  /** The parts above zero: cash, card, then the own rows in order. Empty when not split. */
  lines: PaymentLine[];
  /** Bill minus the parts typed so far, in cents (negative = too much). Split only. */
  remainingCents: number;
}

/** Why a payment cannot be sent, as the key of the cashier's sentence (one wording on every screen). */
export const PAYMENT_PROBLEM_KEY: Record<PaymentProblem, string> = {
  invalid: "pay.invalid",
  duplicate: "pay.ownDuplicate",
  parts: "pay.needAmount",
  sum: "pay.sumMismatch",
};

const NOTE_MAX = 255;
/** The row's `payment_method_other` column: the text of a single «Другое». */
const OTHER_TEXT_MAX = 120;

/**
 * A part as cents. `PriceInput` hands over AMD, and from another display
 * currency that can carry more than two decimals: a number is rounded to the
 * cent, anything else is not an amount.
 */
export const partCents = (raw: string): number | null => {
  const s = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
};

/** A «Свой вариант» name as sent: trimmed, at most {@link OWN_LABEL_MAX}. */
export const ownLabel = (part: OwnPart): string => part.label.trim().slice(0, OWN_LABEL_MAX);

/** The key two names are compared by: case-insensitive, trimmed. */
const ownKey = (part: OwnPart): string => ownLabel(part).toLocaleLowerCase();

/**
 * The own rows whose name another row already has (2026-11-19, owner: names
 * must be distinct, case-insensitive; an unnamed one at most once). The FIRST
 * row with a name keeps it; every later one is the duplicate.
 */
export const duplicateOwnIds = (own: readonly OwnPart[]): Set<number> => {
  const seen = new Set<string>();
  const dup = new Set<number>();
  for (const part of own) {
    const key = ownKey(part);
    if (seen.has(key)) dup.add(part.id);
    else seen.add(key);
  }
  return dup;
};

/** The draft read against the bill: what it would send, or why it cannot. */
export const checkPayment = (dueCents: number, d: PaymentDraft): PaymentCheck => {
  if (!d.split) return { ok: true, problem: null, lines: [], remainingCents: 0 };
  const lines: PaymentLine[] = [];
  let sum = 0;
  const parts: { method: BillMethod; raw: string; label: string }[] = [
    ...SPLIT_METHODS.map((method) => ({ method, raw: d.amounts[method], label: "" })),
    { method: "bonus" as const, raw: d.bonus ?? "", label: "" },
    ...d.own.map((part) => ({ method: "other" as const, raw: part.amount, label: ownLabel(part) })),
  ];
  for (const part of parts) {
    const raw = part.raw.trim();
    if (raw === "") continue;
    const cents = partCents(raw);
    if (cents === null) return { ok: false, problem: "invalid", lines: [], remainingCents: dueCents - sum };
    if (cents === 0) continue;
    sum += cents;
    lines.push(part.label === "" ? { method: part.method, amount: cents / 100 } : { method: part.method, amount: cents / 100, label: part.label });
  }
  const remainingCents = dueCents - sum;
  const problem: PaymentProblem | null =
    duplicateOwnIds(d.own).size > 0 ? "duplicate"
      : lines.length === 0 ? "parts" : remainingCents !== 0 ? "sum" : null;
  return { ok: problem === null, problem, lines, remainingCents };
};

/** One method, as every server has always taken it; the «Другое» text only when typed. */
const singleBody = (method: BillMethod, text: string): { payment_method: BillMethod; payment_method_other?: string } => {
  const typed = method === "other" ? text.trim().slice(0, OTHER_TEXT_MAX) : "";
  return typed === "" ? { payment_method: method } : { payment_method: method, payment_method_other: typed };
};

/**
 * The body the server takes, bonuses included (2026-11-25): for the screens
 * whose bill may be paid with a card's bonuses — a seat's Stop, a till sale.
 * One method — or a split with exactly ONE part above zero (2026-11-15,
 * owner) — sends the fields every server has always taken
 * (`payment_method`, `payment_method_other` only when words were typed). Two
 * or more parts: `payments`, and `payment_note` only when written.
 */
export const billPaymentBody = (d: PaymentDraft, check: PaymentCheck):
  | { payment_method: BillMethod; payment_method_other?: string }
  | { payments: PaymentLine[]; payment_note?: string } => {
  if (!d.split) return singleBody(d.method, d.note);
  // One part left: as a single method; a lone «Свой вариант» sends its name
  // as the «Другое» text, which the server keeps as the name.
  if (check.lines.length === 1) return singleBody(check.lines[0].method, check.lines[0].label ?? d.note);
  const note = d.note.trim().slice(0, NOTE_MAX);
  return note === "" ? { payments: check.lines } : { payments: check.lines, payment_note: note };
};

/** A line of a screen that never takes bonuses. */
export interface MoneyLine extends Omit<PaymentLine, "method"> { method: PaymentMethod }

/**
 * {@link billPaymentBody} for every screen that never takes bonuses (a change
 * of method, a confirmed due): the same body, typed
 * without `bonus`. Those screens never put a bonus in the draft; if one ever
 * did, this throws rather than send it.
 */
export const paymentBody = (d: PaymentDraft, check: PaymentCheck):
  | { payment_method: PaymentMethod; payment_method_other?: string }
  | { payments: MoneyLine[]; payment_note?: string } => {
  const body = billPaymentBody(d, check);
  const hasBonus = "payment_method" in body ? body.payment_method === "bonus" : body.payments.some((l) => l.method === "bonus");
  if (hasBonus) throw new Error("This screen does not take bonuses.");
  return body as { payment_method: PaymentMethod; payment_method_other?: string } | { payments: MoneyLine[]; payment_note?: string };
};

/**
 * How a sum paid AHEAD was paid (2026-11-17, owner: the Stop methods at Start
 * and in «+ Время» too) — the body {@link paymentBody} sends, except that plain
 * cash sends NOTHING: every server has always read no method as cash, so a
 * cash prepayment leaves the request byte for byte as it was. Bonuses
 * (2026-11-25) pay ahead too, only where a card is on the seat.
 */
export const prepaidPaymentFields = (d: PaymentDraft, check: PaymentCheck):
  | Record<string, never>
  | ReturnType<typeof billPaymentBody> => {
  const body = billPaymentBody(d, check);
  return "payment_method" in body && body.payment_method === "cash" && body.payment_method_other === undefined ? {} : body;
};

/** Where «Остаток сюда» was pressed: cash, card, or an own row by its id. */
export type RestTarget = SplitMethod | "bonus" | { own: number };

/** What is still due once every box but the one pressed is counted, as typed text. */
const restText = (dueCents: number, d: PaymentDraft, skipMethod: SplitMethod | "bonus" | null, skipOwn: number | null): string => {
  const others = SPLIT_METHODS.filter((m) => m !== skipMethod).reduce((sum, m) => sum + (partCents(d.amounts[m]) ?? 0), 0)
    + (skipMethod === "bonus" ? 0 : partCents(d.bonus ?? "") ?? 0)
    + d.own.filter((p) => p.id !== skipOwn).reduce((sum, p) => sum + (partCents(p.amount) ?? 0), 0);
  const rest = Math.max(0, dueCents - others);
  return rest === 0 ? "" : toAmount(rest);
};

/** "Остаток сюда": that box filled with what is still due (never below 0). */
export const fillRemaining = (dueCents: number, d: PaymentDraft, target: RestTarget): PaymentDraft => {
  if (typeof target === "object") {
    const text = restText(dueCents, d, null, target.own);
    return { ...d, own: d.own.map((p) => (p.id === target.own ? { ...p, amount: text } : p)) };
  }
  if (target === "bonus") return { ...d, bonus: restText(dueCents, d, "bonus", null) };
  return { ...d, amounts: { ...d.amounts, [target]: restText(dueCents, d, target, null) } };
};

/** A new «Свой вариант» row at the end, under `label` (empty = to be named). */
export const addOwnPart = (d: PaymentDraft, label = ""): PaymentDraft => ({
  ...d,
  own: [...d.own, { id: d.own.reduce((max, p) => Math.max(max, p.id), 0) + 1, label: label.slice(0, OWN_LABEL_MAX), amount: "" }],
});

/** Whether a «Свой вариант» name is already a row of this split (case-insensitive). */
export const hasOwnLabel = (d: PaymentDraft, label: string): boolean => {
  const key = label.trim().toLocaleLowerCase();
  return d.own.some((p) => ownLabel(p).toLocaleLowerCase() === key);
};

/**
 * «Использовать все бонусы» (2026-11-25, owner): never more than the bill.
 * Enough bonuses → one method, `bonus`. Too few → a split: every bonus the
 * card has, the rest put on cash for the cashier to change if paid another
 * way, and how much the card is short.
 */
export const useAllBonuses = (dueCents: number, d: PaymentDraft, balanceCents: number): { draft: PaymentDraft; shortCents: number } => {
  const spend = Math.max(0, Math.min(balanceCents, dueCents));
  if (spend >= dueCents) {
    return { draft: { ...d, split: false, method: "bonus", bonus: "", amounts: { cash: "", card: "" }, own: [] }, shortCents: 0 };
  }
  const short = dueCents - spend;
  return {
    draft: { ...d, split: true, bonus: spend === 0 ? "" : toAmount(spend), amounts: { cash: toAmount(short), card: "" }, own: [] },
    shortCents: short,
  };
};

/**
 * «Сколько бонусами» (2026-11-25, owner): the cashier names the bonus part;
 * the rest goes on cash, to be moved to a card or «Другое» as any split. The
 * part is capped by the bill and the card; all of it is a single «Бонусы».
 */
export const useSomeBonuses = (dueCents: number, d: PaymentDraft, balanceCents: number, wantCents: number): PaymentDraft => {
  const spend = Math.max(0, Math.min(wantCents, balanceCents, dueCents));
  if (spend >= dueCents) return { ...d, split: false, method: "bonus", bonus: "", amounts: { cash: "", card: "" }, own: [] };
  return { ...d, split: true, bonus: spend === 0 ? "" : toAmount(spend), amounts: { cash: toAmount(dueCents - spend), card: "" }, own: [] };
};

/** The draft with no bonuses in it (2026-11-25): the card was taken off the screen. */
export const withoutBonus = (d: PaymentDraft): PaymentDraft =>
  d.method === "bonus" || d.bonus !== "" ? { ...d, method: d.method === "bonus" ? "cash" : d.method, bonus: "" } : d;

/** Whether a body pays anything with bonuses. */
export const bodyUsesBonus = (body: Record<string, unknown>): boolean =>
  body.payment_method === "bonus"
  || (Array.isArray(body.payments) && (body.payments as { method: string }[]).some((l) => l.method === "bonus"));
