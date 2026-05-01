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

// Backend `index` returns User rows with the Manager nested as `manager`.
// All other endpoints (show/update/destroy) use the Manager model id via
// route binding. We normalize to a Manager-shape so the frontend has one
// consistent contract.
type RawIndexRow = {
  id: number;
  name?: string;
  email?: string;
  manager?: {
    id: number;
    user_id: number;
    branch_id: number;
    company_id?: number;
    branch?: { id: number; address: string; city: string };
  };
};

const normalizeIndexRow = (row: RawIndexRow): IManagerApi | null => {
  if (!row?.manager?.id) return null;
  return {
    id: row.manager.id,
    user_id: row.manager.user_id ?? row.id,
    branch_id: row.manager.branch_id,
    company_id: row.manager.company_id,
    branch: row.manager.branch,
    user: { id: row.id, name: row.name ?? "", email: row.email ?? "" },
  };
};

export const apiListManagers = async (params: { branch_id?: number; company_id?: number; per_page?: number; page?: number } = {}) => {
  const r = await request<{ data: RawIndexRow[] }>("/managers", { params });
  const data = (r.data ?? []).map(normalizeIndexRow).filter((m): m is IManagerApi => !!m);
  return { data };
};

export const apiGetManager = (id: number) =>
  request<{ data: IManagerApi }>(`/managers/${id}`);

export const apiCreateManager = (body: CreateManagerBody) =>
  request<{ manager?: IManagerApi; data?: IManagerApi[] }>("/managers", { method: "POST", body });

export const apiUpdateManager = (id: number, body: UpdateManagerBody) =>
  request<{ manager?: IManagerApi }>(`/managers/${id}`, { method: "PUT", body });

export const apiDeleteManager = (id: number) =>
  request<{ message: string }>(`/managers/${id}`, { method: "DELETE" });
