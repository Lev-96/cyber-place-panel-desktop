import { request } from "./client";

export interface ICompanyBilling {
  company_id: number;
  commission_percent: number;
  last_paid_at: string | null;
  next_due_at: string | null;
  days_until_due: number | null;
  is_overdue: boolean;
  status: "pending" | "active";
}

export interface IBillingReminder {
  id: number;
  name: string;
  email: string;
  commission_percent: number;
  last_paid_at: string | null;
  next_due_at: string | null;
  days_until_due: number | null;
  is_overdue: boolean;
  status: "pending" | "active";
}

export const apiCompanyBilling = (companyId: number) =>
  request<ICompanyBilling>(`/company/${companyId}/billing`);

/**
 * One branch's row of the revenue summary. Every branch of the company is
 * listed, zero rows included, in id order. `commission_amount` HERE is on the
 * branch's `total_gross` (tournaments included) — unlike the company-level
 * `commission_amount`. A branch commission can differ from its share of the
 * company commission by a rounding hundredth; the company figures are the
 * authoritative ones. Nothing here is recomputed by the client.
 */
export interface IBranchRevenueSummary {
  branch_id: number;
  address: string | null;
  sessions_count: number;
  sessions_total: number;
  pos_total: number;
  tournaments_count: number;
  tournaments_total: number;
  /** Sessions + POS. */
  gross_total: number;
  /** Sessions + POS + tournament fees. */
  total_gross: number;
  commission_amount: number;
  owner_income: number;
}

/**
 * Operational revenue + commission for a company over a window.
 * `from`/`to` accept full ISO timestamps with timezone offset (preferred)
 * or bare "YYYY-MM-DD" (interpreted as midnight in server TZ).
 *
 * The first block is the contract as it stood before tournament fees were
 * recorded, and keeps its meaning: `gross_total` is sessions + POS and
 * `commission_amount` is the commission on that. Everything after it was
 * appended on 2026-09-11 and is optional, so a panel pointed at an older
 * backend still type-checks and renders the old figures.
 */
export interface ICompanyRevenueSummary {
  company_id: number;
  from: string;
  to: string;
  /** How many closed sessions the figure below is made of. */
  sessions_count: number;
  sessions_total: number;
  pos_total: number;
  /** Sessions + POS. */
  gross_total: number;
  commission_percent: number;
  /** Commission on `gross_total` only — tournament fees excluded. */
  commission_amount: number;

  /** Paid tournament entries (a verified player's entry fee). */
  tournaments_count?: number;
  tournaments_total?: number;
  tournaments_commission_amount?: number;
  /** Sessions + POS + tournament fees — the company's whole takings. */
  total_gross?: number;
  /** Commission on `total_gross`: what Cyber Place is owed for the window. */
  total_commission_amount?: number;
  /** `total_gross` less `total_commission_amount`, computed by the server. */
  owner_income?: number;
  branches?: IBranchRevenueSummary[];
}

export const apiCompanyRevenueSummary = (
  companyId: number,
  range?: { from?: string; to?: string },
) =>
  request<ICompanyRevenueSummary>(`/company/${companyId}/revenue-summary`, {
    params: { from: range?.from, to: range?.to },
  });

export const apiMarkCompanyPaid = (companyId: number) =>
  request<ICompanyBilling & { message: string }>(`/company/${companyId}/mark-paid`, { method: "POST" });

export const apiBillingReminders = (withinDays = 3) =>
  request<{ data: IBillingReminder[] }>("/company-billing/reminders", { params: { within_days: withinDays } });

export const apiRunBillingCheck = () =>
  request<{ reminded: number; marked_pending: number }>("/company-billing/run-check", { method: "POST" });
