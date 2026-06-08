import { Currency } from "@/i18n/currency";
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
export interface IServiceExpense {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  purchased_at: string; // YYYY-MM-DD
  is_active: boolean;
  next_due_at: string; // ISO 8601
  days_until_due: number;
  created_at: string | null;
}

export interface ServiceExpenseBody {
  name: string;
  amount: number;
  currency: Currency;
  purchased_at: string; // YYYY-MM-DD
  is_active?: boolean;
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

export const apiDeleteServiceExpense = (id: number) =>
  request<null>(`/admin/service-expenses/${id}`, { method: "DELETE" });
