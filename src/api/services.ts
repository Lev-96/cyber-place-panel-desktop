import { IBranchService, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetServicesParams {
  branch_id?: number;
  per_page?: number;
  page?: number;
}

export interface CreateServiceBody {
  name_en: string;
  name_ru: string;
  name_am: string;
  service_logo_path?: File | null;
}

export const apiGetServices = (params: GetServicesParams = {}) =>
  request<PaginatedList<IBranchService>>("/services", { params });

export const apiGetServiceById = (id: number) =>
  request<{ service: IBranchService }>(`/services/${id}`);

const buildServiceForm = (body: CreateServiceBody): FormData => {
  const fd = new FormData();
  fd.append("name_en", body.name_en);
  fd.append("name_ru", body.name_ru);
  fd.append("name_am", body.name_am);
  if (body.service_logo_path instanceof File) {
    fd.append("service_logo_path", body.service_logo_path);
  }
  return fd;
};

export const apiCreateService = (body: CreateServiceBody) =>
  request<{ data: IBranchService; service?: IBranchService }>("/services", { method: "POST", body: buildServiceForm(body) });

export const apiUpdateService = (id: number, body: CreateServiceBody) =>
  request<{ data: IBranchService; service?: IBranchService }>(`/services/${id}?_method=PUT`, { method: "POST", body: buildServiceForm(body) });

export const apiDeleteService = (id: number) =>
  request<{ message: string }>(`/services/${id}`, { method: "DELETE" });
