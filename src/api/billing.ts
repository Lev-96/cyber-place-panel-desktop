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

export const apiMarkCompanyPaid = (companyId: number) =>
  request<ICompanyBilling & { message: string }>(`/company/${companyId}/mark-paid`, { method: "POST" });

export const apiBillingReminders = (withinDays = 3) =>
  request<{ data: IBillingReminder[] }>("/company-billing/reminders", { params: { within_days: withinDays } });

export const apiRunBillingCheck = () =>
  request<{ reminded: number; marked_pending: number }>("/company-billing/run-check", { method: "POST" });
