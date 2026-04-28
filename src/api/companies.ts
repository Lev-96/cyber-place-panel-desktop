import { CompanyStatusType, ICompanyApi, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetCompaniesParams {
  per_page?: number;
  page?: number;
  name?: string;
}

export interface CreateCompanyBody {
  user_id: number;
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

export type UpdateCompanyBody = Omit<Partial<CreateCompanyBody>, "user_id" | "company_logo_path"> & {
  company_logo_path?: File | null;
  status?: CompanyStatusType;
  commission_percent?: number;
};

export const apiGetCompanies = (params: GetCompaniesParams = {}) =>
  request<PaginatedList<ICompanyApi>>("/company", { params });

export const apiGetCompanyById = (id: number) =>
  request<{ companies: ICompanyApi }>(`/company/${id}`);

const buildCompanyForm = (body: Record<string, unknown>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null || v === "") continue;
    if (v instanceof File) fd.append(k, v);
    else fd.append(k, String(v));
  }
  return fd;
};

export const apiCreateCompany = (body: CreateCompanyBody) =>
  request<{ companies: ICompanyApi; message?: string }>("/company", { method: "POST", body: buildCompanyForm(body as any) });

export const apiUpdateCompany = (id: number, body: UpdateCompanyBody) =>
  request<{ companies: ICompanyApi; message?: string }>(`/company/${id}?_method=PUT`, { method: "POST", body: buildCompanyForm(body as any) });

export const apiDeleteCompany = (id: number) =>
  request<{ message: string }>(`/company/${id}`, { method: "DELETE" });
