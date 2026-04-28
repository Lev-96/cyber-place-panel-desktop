import { request } from "./client";

export interface IManagerApi {
  id: number;
  user_id: number;
  branch_id: number;
  company_id?: number;
  user?: { id: number; name: string; email: string };
  branch?: { id: number; address: string; city: string };
  created_at?: string;
}

export interface CreateManagerBody {
  branch_id: number;
  company_id: number;
  email: string;
  name: string;
  password: string;
  password_confirmation: string;
}

export interface UpdateManagerBody {
  name: string;
  email: string;
}

export const apiListManagers = (params: { branch_id?: number; company_id?: number; per_page?: number; page?: number } = {}) =>
  request<{ data: IManagerApi[] }>("/managers", { params });

export const apiGetManager = (id: number) =>
  request<{ data: IManagerApi }>(`/managers/${id}`);

export const apiCreateManager = (body: CreateManagerBody) =>
  request<{ manager?: IManagerApi; data?: IManagerApi[] }>("/managers", { method: "POST", body });

export const apiUpdateManager = (id: number, body: UpdateManagerBody) =>
  request<{ manager?: IManagerApi }>(`/managers/${id}`, { method: "PUT", body });

export const apiDeleteManager = (id: number) =>
  request<{ message: string }>(`/managers/${id}`, { method: "DELETE" });
