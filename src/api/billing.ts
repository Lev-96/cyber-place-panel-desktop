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
 * Operational revenue + commission for a company over a window.
 * `from`/`to` accept full ISO timestamps with timezone offset (preferred)
 * or bare "YYYY-MM-DD" (interpreted as midnight in server TZ).
 */
export interface ICompanyRevenueSummary {
  company_id: number;
  from: string;
  to: string;
  sessions_total: number;
  pos_total: number;
  gross_total: number;
  commission_percent: number;
  commission_amount: number;
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
