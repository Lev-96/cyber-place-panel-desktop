import { ICompanyApi, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetCompaniesParams {
  per_page?: number;
  page?: number;
  name?: string;
}

export const apiGetCompanies = (params: GetCompaniesParams = {}) =>
  request<PaginatedList<ICompanyApi>>("/company", { params });

export const apiGetCompanyById = (id: number) =>
  request<{ companies: ICompanyApi }>(`/company/${id}`);
