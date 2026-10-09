import { CompanyStatusType, ICompanyApi, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetCompaniesParams {
  per_page?: number;
  page?: number;
  name?: string;
}

export interface CreateCompanyBody {
  /**
   * The new owner, created with the company in one transaction. They get an
   * email link to set their own password — no password is sent.
   */
  owner_name: string;
  owner_email: string;
  name: string;
  email: string;
  phone: string;
  company_country: string;
  company_city: string;
  tin: string;
  website?: string;
  description?: string;
  company_logo_path: File;
  status?: CompanyStatusType;
  commission_percent?: number;
}

export type UpdateCompanyBody = Omit<Partial<CreateCompanyBody>, "owner_name" | "owner_email" | "company_logo_path"> & {
  company_logo_path?: File | null;
  status?: CompanyStatusType;
  commission_percent?: number;
};

export const apiGetCompanies = (params: GetCompaniesParams = {}) =>
  request<PaginatedList<ICompanyApi>>("/company", { params });

export const apiGetCompanyById = (id: number) =>
  request<{ companies: ICompanyApi }>(`/company/${id}`);

/**
 * Build a multipart payload from any plain object. Values pass through
 * `String()` unless they're a File (sent as-is). Empty / null / undefined
 * are dropped so optional fields don't show up as "null" on the backend.
 *
 * Typed as `object` so both CreateCompanyBody and UpdateCompanyBody fit
 * structurally — no `as any` required at the call site.
 */
const buildCompanyForm = (body: object, keepEmpty: readonly string[] = []): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) {
    // An emptied field the backend may clear is sent as "" (it would otherwise
    // be dropped and silently keep its old value).
    if (v === "" && keepEmpty.includes(k)) { fd.append(k, ""); continue; }
    if (v === undefined || v === null || v === "") continue;
    if (v instanceof File) fd.append(k, v);
    else fd.append(k, String(v));
  }
  return fd;
};

export const apiCreateCompany = (body: CreateCompanyBody) =>
  request<{ companies: ICompanyApi; message?: string }>("/company", { method: "POST", body: buildCompanyForm(body) });

/**
 * Fields an edit may CLEAR (2026-10-09). An emptied description used to be
 * dropped from the payload, so the server kept the old text and answered
 * "saved". The backend accepts an empty one (`nullable`) and stores it as "".
 */
const CLEARABLE_ON_UPDATE = ["description"] as const;

export const apiUpdateCompany = (id: number, body: UpdateCompanyBody) =>
  request<{ companies: ICompanyApi; message?: string }>(`/company/${id}?_method=PUT`, { method: "POST", body: buildCompanyForm(body, CLEARABLE_ON_UPDATE) });

export const apiDeleteCompany = (id: number) =>
  request<{ message: string }>(`/company/${id}`, { method: "DELETE" });
