import { IBranchApi, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetBranchesParams {
  company_id?: number;
  city?: string;
  country?: string;
  per_page?: number;
  page?: number;
}

export interface CreateBranchBody {
  address: string;
  city: string;
  country: string;
  phone: string;
  address_lat: number;
  address_lng: number;
  company_id?: number;
  branch_logo_path?: File | null;
}

export type UpdateBranchBody = Partial<CreateBranchBody>;

const buildBranchForm = (body: Record<string, unknown>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null || v === "") continue;
    if (v instanceof File) fd.append(k, v);
    else fd.append(k, String(v));
  }
  return fd;
};

const hasFile = (b: Record<string, unknown>): boolean =>
  Object.values(b).some((v) => v instanceof File);

export const apiGetBranches = (params: GetBranchesParams = {}) =>
  request<PaginatedList<IBranchApi>>("/branches", { params });

export const apiGetBranchById = (id: number) =>
  request<{ branch: IBranchApi }>(`/branches/${id}`);

export const apiCreateBranch = (body: CreateBranchBody) => {
  const useForm = hasFile(body as unknown as Record<string, unknown>);
  return request<{ branch: IBranchApi; message?: string }>("/branches", {
    method: "POST",
    body: useForm ? buildBranchForm(body as unknown as Record<string, unknown>) : body,
  });
};

export const apiUpdateBranch = (id: number, body: UpdateBranchBody) => {
  const useForm = hasFile(body as unknown as Record<string, unknown>);
  return request<{ branch: IBranchApi; message?: string }>(`/branches/${id}?_method=PUT`, {
    method: "POST",
    body: useForm ? buildBranchForm(body as unknown as Record<string, unknown>) : body,
  });
};

export const apiDeleteBranch = (id: number) =>
  request<{ message: string }>(`/branches/${id}`, { method: "DELETE" });

export const apiUpdateBranchPricing = (id: number, prices: NonNullable<IBranchApi["price_for_branch"]>) =>
  request<{ message: string }>(`/branches/${id}?_method=PUT`, { method: "POST", body: { prices } });

export const apiUpdateBranchOpenDays = (id: number, days_of_weeks: Array<{ day_of_week: number; start_time: string; end_time: string }>) =>
  request<{ message: string }>(`/branches/${id}?_method=PUT`, { method: "POST", body: { days_of_weeks } });

export const apiUpdateBranchServices = (id: number, service_ids: number[]) =>
  request<{ message: string }>(`/branches/${id}?_method=PUT`, { method: "POST", body: { service_ids } });

/**
 * Set or rotate the emergency unlock PIN for this branch. PIN is shipped
 * to every agent in the branch on its next /agent/hello so a cashier
 * can rescue a stuck kiosk by typing the PIN directly on the lock
 * screen — works even when the panel/server is unreachable.
 *
 * Backend stores BOTH a bcrypt hash (agent verifies against this) and
 * an APP_KEY-encrypted copy (so the panel can show the current PIN
 * back via apiGetBranchUnlockPin).
 */
export const apiSetBranchUnlockPin = (id: number, pin: string) =>
  request<{ message: string; data: { unlock_pin_updated_at: string } }>(
    `/branches/${id}/unlock-pin`,
    { method: "POST", body: { pin } },
  );

/**
 * Read the current plaintext PIN for this branch. Decrypted server-side
 * with APP_KEY. Returns null when the branch has never set a PIN OR
 * when a legacy row exists with only the hash (pre-encrypted column).
 *
 * Auth: admin / owner / manager of the branch's company. Agent kiosks
 * NEVER call this; they receive only the bcrypt hash.
 */
export const apiGetBranchUnlockPin = (id: number) =>
  request<{ data: { pin: string | null } }>(`/branches/${id}/unlock-pin`);
