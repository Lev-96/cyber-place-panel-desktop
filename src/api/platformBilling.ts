import { request } from "./client";
import { isMissingEndpoint } from "./fallback";
import type {
  IAdjustmentPayload,
  IAdminInvoiceFilters,
  IExtendPayload,
  IPlatformBillingOverview,
  IPlatformInvoiceAdminRow,
  IPlatformInvoiceDetail,
  IPlatformInvoicePage,
  IPlatformInvoiceSummary,
  IRecordPaymentPayload,
  MoneyString,
} from "@/types/platformBilling";

/**
 * Cyber Place Platform billing (2026-11-09) — the transport, typed.
 *
 * Nothing here is cached (`httpCache` POLICIES does not list these paths):
 * money owed is live data, and a stale balance is a wrong balance.
 *
 * A backend that predates the feature answers 404 on every path below. The
 * `…OrNull` readers turn exactly that (and only that: see `isMissingEndpoint`)
 * into `null`, which every caller reads as "this server has no platform
 * billing" and hides its card. Any other failure is rethrown.
 */

/**
 * Admin list totals over the WHOLE filtered set (not just the page), as the
 * server sends them: `count` invoices, their `amount` charged and `balance`
 * still owed.
 */
export interface IAdminInvoiceTotals {
  count?: number;
  amount?: MoneyString;
  balance?: MoneyString;
}

export type IAdminInvoicePage = IPlatformInvoicePage<IPlatformInvoiceAdminRow> & { totals?: IAdminInvoiceTotals };

/** The invoice endpoints answer `{data: …}` (a JsonResource); this takes the record out. */
const unwrap = async <T>(p: Promise<{ data: T }>): Promise<T> => (await p).data;

const orNull = async <T>(p: Promise<T>): Promise<T | null> => {
  try { return await p; }
  catch (e) { if (isMissingEndpoint(e)) return null; throw e; }
};

export const apiPlatformBilling = (companyId: number) =>
  request<IPlatformBillingOverview>(`/company/${companyId}/platform-billing`);

/** The owner's debt card, or null when this backend has no platform billing. */
export const apiPlatformBillingOrNull = (companyId: number) => orNull(apiPlatformBilling(companyId));

export const apiCompanyInvoices = (companyId: number, page = 1, perPage = 10) =>
  request<IPlatformInvoicePage<IPlatformInvoiceSummary>>(`/company/${companyId}/platform-invoices`, {
    params: { page, per_page: perPage },
  });

export const apiPlatformInvoice = (invoiceId: number) =>
  unwrap(request<{ data: IPlatformInvoiceDetail }>(`/platform-invoices/${invoiceId}`));

/** Admin: every company's invoices. */
export const apiAdminInvoices = (filters: IAdminInvoiceFilters = {}) =>
  request<IAdminInvoicePage>("/platform-invoices", {
    params: {
      state: filters.state || undefined,
      company_id: filters.company_id,
      page: filters.page,
      per_page: filters.per_page,
    },
  });

/** Admin: the open-invoice list, or null when this backend has no platform billing. */
export const apiAdminInvoicesOrNull = (filters: IAdminInvoiceFilters = {}) => orNull(apiAdminInvoices(filters));

export const apiRecordPayment = (invoiceId: number, body: IRecordPaymentPayload) =>
  unwrap(request<{ data: IPlatformInvoiceDetail; replayed?: boolean }>(`/platform-invoices/${invoiceId}/payments`, { method: "POST", body }));

export const apiAdjustInvoice = (invoiceId: number, body: IAdjustmentPayload) =>
  unwrap(request<{ data: IPlatformInvoiceDetail; replayed?: boolean }>(`/platform-invoices/${invoiceId}/adjustments`, { method: "POST", body }));

export const apiExtendInvoice = (invoiceId: number, body: IExtendPayload) =>
  unwrap(request<{ data: IPlatformInvoiceDetail; replayed?: boolean }>(`/platform-invoices/${invoiceId}/extend`, { method: "POST", body }));
