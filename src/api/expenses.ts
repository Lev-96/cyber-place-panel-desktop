import { Currency } from "@/i18n/currency";
import { Lang } from "@/i18n/translations";
import { Translated } from "@/i18n/translated";
import { request } from "./client";

/**
 * Admin-only recurring-services expense tracker.
 *
 * Endpoints live under `/admin/service-expenses` (admin Sanctum guard).
 * `next_due_at` / `days_until_due` are derived on the backend model — the
 * client never recomputes the monthly cycle. `amount` is in the literal
 * `currency` the admin pays in; cross-currency totals are rolled up on
 * the client via `moneyDisplay.convertBetween`.
 */
export interface IServiceExpense extends Translated {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  purchased_at: string; // YYYY-MM-DD
  is_active: boolean;
  next_due_at: string; // ISO 8601
  days_until_due: number; // negative = overdue
  is_overdue: boolean;
  last_paid_at: string | null; // YYYY-MM-DD
  created_at: string | null;
}

export interface ServiceExpenseBody {
  name: string;
  amount: number;
  currency: Currency;
  purchased_at: string; // YYYY-MM-DD
  is_active?: boolean;
  /**
   * Language the admin typed `name` in. The backend treats this locale as the
   * source of truth and machine-translates the others — it never writes back
   * into it. Omitted by older panel builds, which the backend falls back to its
   * configured default for.
   */
  source_locale?: Lang;
}

export const apiServiceExpenses = () =>
  request<{ data: IServiceExpense[] }>("/admin/service-expenses");

/** On-demand "remind me N days before" feed (default 3). */
export const apiServiceExpenseReminders = (withinDays = 3) =>
  request<{ data: IServiceExpense[] }>("/admin/service-expenses/reminders", {
    params: { within_days: withinDays },
  });

export const apiCreateServiceExpense = (body: ServiceExpenseBody) =>
  request<{ data: IServiceExpense }>("/admin/service-expenses", { method: "POST", body });

export const apiUpdateServiceExpense = (id: number, body: Partial<ServiceExpenseBody>) =>
  request<{ data: IServiceExpense }>(`/admin/service-expenses/${id}`, { method: "PUT", body });

/** Settle the current month — advances next_due_at one cycle forward. */
export const apiMarkServiceExpensePaid = (id: number) =>
  request<{ data: IServiceExpense }>(`/admin/service-expenses/${id}/mark-paid`, { method: "POST" });

export const apiDeleteServiceExpense = (id: number) =>
  request<null>(`/admin/service-expenses/${id}`, { method: "DELETE" });
