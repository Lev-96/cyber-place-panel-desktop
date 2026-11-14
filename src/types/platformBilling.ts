/**
 * Cyber Place Platform billing (2026-11-09): what a club owes the platform for
 * a calendar month, the invoice that snapshots it, and what an unpaid invoice
 * does to the club's access.
 *
 * Mirrors the backend's contract (`PlatformInvoice*` resources,
 * `App\Enums\BillingAccess`). Every figure here is the SERVER's: money arrives
 * as decimal strings ("12500.00") and is only ever formatted, never added,
 * multiplied or compared to work something out. Balance, state, overdue days
 * and access are computed by the backend and printed as they came.
 */

/** `App\Enums\BillingAccess`: what an unpaid invoice does to new work at the club. */
export type BillingAccess = "active" | "restricted" | "suspended";

export const BILLING_ACCESS = {
  active: "active",
  restricted: "restricted",
  suspended: "suspended",
} as const satisfies Record<BillingAccess, BillingAccess>;

const ACCESS_VALUES: readonly string[] = Object.values(BILLING_ACCESS);

/** A value the server sent, narrowed; anything unknown (or absent) reads as `active`. */
export const billingAccessOf = (raw: unknown): BillingAccess =>
  typeof raw === "string" && ACCESS_VALUES.includes(raw) ? (raw as BillingAccess) : BILLING_ACCESS.active;

/** New sessions / reservations / tournaments are refused (D+5 and later). */
export const isBillingLimited = (raw: unknown): boolean => billingAccessOf(raw) !== BILLING_ACCESS.active;

/** Derived invoice state (computed by the service, never stored). */
export type BillingState = "pending" | "due" | "overdue" | "partially_paid" | "paid" | "cancelled";

export const BILLING_STATES = ["pending", "due", "overdue", "partially_paid", "paid", "cancelled"] as const satisfies readonly BillingState[];

/** A value the server sent, or null for one this build does not know. */
export const billingStateOf = (raw: unknown): BillingState | null =>
  typeof raw === "string" && (BILLING_STATES as readonly string[]).includes(raw) ? (raw as BillingState) : null;

/** Stored invoice status. */
export type InvoiceStatus = "open" | "paid" | "cancelled";

/** Money as the server sends it: a decimal string with two places ("12500.00"). */
export type MoneyString = string;

/** One invoice, as listed (`InvoiceSummary`). */
export interface IPlatformInvoiceSummary {
  id: number;
  company_id: number;
  company_name?: string | null;
  /** YYYY-MM-DD, Asia/Yerevan calendar month. */
  period_start: string;
  period_end: string;
  currency: string;
  commission_percent: MoneyString;
  gross_amount: MoneyString;
  amount: MoneyString;
  paid_amount: MoneyString;
  adjustments_amount: MoneyString;
  balance: MoneyString;
  issued_at: string | null;
  /** The original due date (the 10th of the next month). */
  due_on: string;
  /** The due date in force: `due_on`, or the date an admin extended it to. */
  effective_due_on: string;
  paid_at: string | null;
  status: InvoiceStatus;
  billing_state: BillingState;
  days_overdue: number;
  billing_access: BillingAccess;
}

/** Admin list row: the summary plus who it belongs to. */
export interface IPlatformInvoiceAdminRow extends IPlatformInvoiceSummary {
  /** Branch addresses of the company (for the list); optional on older payloads. */
  branches?: Array<{ id: number; address: string }>;
}

/** A per-branch line of the revenue base snapshotted on the invoice. */
export interface IPlatformInvoiceBreakdownRow {
  branch_id: number;
  address?: string | null;
  sessions_amount?: MoneyString;
  pos_amount?: MoneyString;
  tournaments_amount?: MoneyString;
  gross_amount?: MoneyString;
}

export type InvoiceEntryType = "payment" | "adjustment";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";
export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"] as const satisfies readonly PaymentMethod[];

/** One ledger line: a payment (positive) or an adjustment (signed). */
export interface IPlatformInvoiceEntry {
  id: number;
  type: InvoiceEntryType;
  amount: MoneyString;
  method?: PaymentMethod | string | null;
  reference?: string | null;
  note?: string | null;
  occurred_at: string;
  recorded_by_name?: string | null;
}

/** Journal kinds (`platform_invoice_events.kind`). */
export type InvoiceEventKind =
  | "issued" | "reminder_d_minus_3" | "due_today" | "overdue_d2" | "restricted_d5" | "suspended_d7"
  | "payment_recorded" | "adjustment_recorded" | "extended" | "restored" | "paid";

export const INVOICE_EVENT_KINDS = [
  "issued", "reminder_d_minus_3", "due_today", "overdue_d2", "restricted_d5", "suspended_d7",
  "payment_recorded", "adjustment_recorded", "extended", "restored", "paid",
] as const satisfies readonly InvoiceEventKind[];

export interface IPlatformInvoiceEvent {
  id: number;
  kind: InvoiceEventKind | string;
  due_on: string | null;
  created_at: string;
  actor_name?: string | null;
  meta?: Record<string, unknown> | null;
}

/** `GET /platform-invoices/{id}`. */
export interface IPlatformInvoiceDetail extends IPlatformInvoiceSummary {
  sessions_amount?: MoneyString;
  pos_amount?: MoneyString;
  tournaments_amount?: MoneyString;
  breakdown?: IPlatformInvoiceBreakdownRow[];
  entries?: IPlatformInvoiceEntry[];
  events?: IPlatformInvoiceEvent[];
  /** Translation-key style ids of what the base includes / excludes (server-owned wording ids). */
  included?: string[];
  excluded?: string[];
}

/** `GET /company/{id}/platform-billing`: the owner's debt card. */
export interface IPlatformBillingOverview {
  company_id: number;
  currency: string;
  commission_percent: MoneyString;
  current_period: {
    start: string;
    end: string;
    gross_amount: MoneyString;
    commission_amount: MoneyString;
    /** Always true: the month is still running, the figure will change. */
    is_estimate: boolean;
  };
  outstanding_amount: MoneyString;
  open_invoice: IPlatformInvoiceSummary | null;
  next_due_on: string | null;
  billing_state: BillingState | null;
  billing_access: BillingAccess;
  days_overdue: number;
}

/** Laravel paginator, as the invoice lists answer. */
export interface IPlatformInvoicePage<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** `POST /platform-invoices/{id}/payments`. */
export interface IRecordPaymentPayload {
  amount: string;
  method: PaymentMethod;
  occurred_at?: string;
  reference?: string;
  note?: string;
}

/** `POST /platform-invoices/{id}/adjustments`: a signed amount and why. */
export interface IAdjustmentPayload {
  amount: string;
  reason: string;
}

/** `POST /platform-invoices/{id}/extend`: a later due date and why. */
export interface IExtendPayload {
  new_due_on: string;
  reason: string;
}

/** Admin list filters. */
export interface IAdminInvoiceFilters {
  state?: BillingState | "open" | "";
  company_id?: number;
  page?: number;
  per_page?: number;
}
