import { VENUE_TIME_ZONE } from "@/i18n/dates";
import {
  PAYMENT_METHODS,
  type IAdjustmentPayload,
  type IExtendPayload,
  type IRecordPaymentPayload,
  type PaymentMethod,
} from "@/types/platformBilling";

/**
 * The admin's three invoice writes, as pure functions (2026-11-09): what the
 * form must hold before a request may leave, and the exact body sent. The
 * server validates everything again; this is the boundary check that keeps a
 * half-typed form from reaching the confirm step.
 *
 * Amounts stay STRINGS end to end ("1500.50"): typed, validated, sent. No
 * float ever touches a money value here.
 */

export type ActionKind = "payment" | "adjustment" | "extend";

/** Each validator answers a translation key (what is wrong) or the payload. */
export type Validated<T> = { ok: true; payload: T } | { ok: false; errorKey: string };

const POSITIVE = /^\d{1,12}(\.\d{1,2})?$/;
const SIGNED = /^-?\d{1,12}(\.\d{1,2})?$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const REASON_MAX = 500;
export const REFERENCE_MAX = 120;
export const NOTE_MAX = 500;

/** Normalise what was typed: trim, a decimal comma becomes a point. */
export const normaliseAmount = (raw: string): string => raw.trim().replace(",", ".");

const isZero = (s: string): boolean => /^-?0+(\.0+)?$/.test(s);

const optional = (s: string): string | undefined => {
  const v = s.trim();
  return v === "" ? undefined : v;
};

export interface PaymentForm {
  amount: string;
  method: string;
  reference: string;
  note: string;
}

export const validatePayment = (f: PaymentForm): Validated<IRecordPaymentPayload> => {
  const amount = normaliseAmount(f.amount);
  if (!POSITIVE.test(amount) || isZero(amount)) return { ok: false, errorKey: "platformBilling.admin.invalidAmount" };
  if (!(PAYMENT_METHODS as readonly string[]).includes(f.method)) return { ok: false, errorKey: "platformBilling.admin.method" };
  return {
    ok: true,
    payload: {
      amount,
      method: f.method as PaymentMethod,
      reference: optional(f.reference)?.slice(0, REFERENCE_MAX),
      note: optional(f.note)?.slice(0, NOTE_MAX),
    },
  };
};

export interface AdjustmentForm {
  amount: string;
  reason: string;
}

export const validateAdjustment = (f: AdjustmentForm): Validated<IAdjustmentPayload> => {
  const amount = normaliseAmount(f.amount);
  if (!SIGNED.test(amount) || isZero(amount)) return { ok: false, errorKey: "platformBilling.admin.invalidSigned" };
  const reason = f.reason.trim();
  if (reason === "") return { ok: false, errorKey: "platformBilling.admin.reasonRequired" };
  return { ok: true, payload: { amount, reason: reason.slice(0, REASON_MAX) } };
};

export interface ExtendForm {
  newDueOn: string;
  reason: string;
}

/** `today` is the venue's calendar day, YYYY-MM-DD (see {@link venueToday}). */
export const validateExtend = (f: ExtendForm, today: string): Validated<IExtendPayload> => {
  // ISO dates compare correctly as strings.
  if (!YMD.test(f.newDueOn) || f.newDueOn <= today) return { ok: false, errorKey: "platformBilling.admin.dateAfterToday" };
  const reason = f.reason.trim();
  if (reason === "") return { ok: false, errorKey: "platformBilling.admin.reasonRequired" };
  return { ok: true, payload: { new_due_on: f.newDueOn, reason: reason.slice(0, REASON_MAX) } };
};

const venueDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: VENUE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Today in Yerevan, YYYY-MM-DD: the calendar the due dates are kept in. */
export const venueToday = (now: Date = new Date()): string => venueDay.format(now);
