import { request } from "./client";

/**
 * «Мои партнёры» (2026-11-18, owner): the company's partners whose fast food
 * the club sells, and the month's split with them. Mirrors the backend's
 * `PartnerResource` / `PartnerSettlementResource`. Money is the server's
 * 2-place decimal string ("90000.00"); the panel formats it and never works
 * a share out itself.
 */

/**
 * `percent`: the CLUB keeps `percent` % of the month's sales, the partner gets
 * the rest. `fixed`: the partner pays the club `fixed_amount` a month and gets
 * the sales minus it (below zero = the partner owes the club).
 */
export type PartnerTerms = "percent" | "fixed";

export interface IPartner {
  id: number;
  company_id: number;
  name: string;
  phone: string | null;
  note: string | null;
  terms: PartnerTerms;
  /** "10.00" on percent terms, else null. */
  percent: string | null;
  /** "50000.00" on fixed terms, else null. */
  fixed_amount: string | null;
  active: boolean;
  archived: boolean;
  archived_at: string | null;
  /** Only on the list (`withCount`): a create / edit answer has no count. */
  products_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * `POST /companies/{company}/partners` and `PATCH /partners/{id}`. The figure
 * goes with its terms: `percent` on percent terms, `fixed_amount` on fixed
 * ones, never both (the server refuses the other one).
 */
export type PartnerBody = {
  name: string;
  phone: string | null;
  note: string | null;
} & ({ terms: "percent"; percent: number } | { terms: "fixed"; fixed_amount: number });

/** One product a partner (or the club) sold in the month, prices merged. */
export interface ISettlementRow {
  product_id: number;
  name: string;
  quantity: number;
  total: string;
}

export interface IPartnerSettlement {
  partner: { id: number; name: string; active: boolean; archived: boolean };
  terms: { terms: PartnerTerms; percent: string | null; fixed_amount: string | null };
  sales_total: string;
  units: number;
  rows: ISettlementRow[];
  club_share: string;
  /** Negative when a fixed sum is more than the month sold. */
  partner_share: string;
  /** The partner owes the club (the server's word, never compared here). */
  partner_owes: boolean;
}

export interface ISettlement {
  company_id: number;
  month: string;
  branch_id: number | null;
  windows: { branch_id: number; from: string; to: string }[];
  terms_note: string;
  partners: IPartnerSettlement[];
  own: { sales_total: string; units: number; rows: ISettlementRow[] };
  totals: {
    sales_total: string;
    units: number;
    club_share: string;
    partner_share: string;
    fast_food_total: string;
    fast_food_units: number;
  };
}

export const apiListPartners = (companyId: number, includeArchived = false) =>
  request<{ data: IPartner[] }>(`/companies/${companyId}/partners`, {
    params: includeArchived ? { include_archived: 1 } : {},
    noCache: true,
  });

export const apiCreatePartner = (companyId: number, body: PartnerBody) =>
  request<{ data: IPartner }>(`/companies/${companyId}/partners`, { method: "POST", body });

export const apiUpdatePartner = (id: number, body: PartnerBody) =>
  request<{ data: IPartner }>(`/partners/${id}`, { method: "PATCH", body });

/** Archives: a partner is never deleted. */
export const apiArchivePartner = (id: number) =>
  request<{ data: IPartner }>(`/partners/${id}`, { method: "DELETE" });

/** `month` is `YYYY-MM`; without a branch, every branch of the company. Never cached: money. */
export const apiPartnerSettlement = (companyId: number, q: { month: string; branch_id?: number }) =>
  request<{ data: ISettlement }>(`/companies/${companyId}/partners/settlement`, { params: q, noCache: true });
