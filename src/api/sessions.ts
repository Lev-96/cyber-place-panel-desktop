import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";
import { request } from "./client";

export interface StartSessionBody {
  branch_id: number;
  pc_id: number;
  mode?: "fixed" | "open";
  time_package_id?: number;
  hourly_rate?: number;
  user_display_name?: string;
}

export interface ExtendSessionBody {
  time_package_id: number;
}

/* When the backend's `/sessions`, `/pcs`, `/time-packages` migrations are
   not yet deployed, repositories return `[]` via api/fallback (orFallback). */

export const apiListActiveSessions = (branchId: number) =>
  request<{ data: ISessionApi[] }>("/sessions", { params: { branch_id: branchId, status: "active" } });

export interface ListSessionsParams {
  branch_id?: number;
  pc_id?: number;
  status?: "active" | "stopped" | "expired";
  /** ISO date (YYYY-MM-DD); inclusive — backend expands to startOfDay. */
  from?: string;
  /** ISO date (YYYY-MM-DD); inclusive — backend expands to endOfDay. */
  to?: string;
  limit?: number;
}

export const apiListSessions = (params: ListSessionsParams) =>
  request<{ data: ISessionApi[] }>("/sessions", { params });

export const apiStartSession = (body: StartSessionBody) =>
  request<{ session: ISessionApi }>("/sessions", { method: "POST", body });

export const apiStopSession = (id: number) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/stop`, { method: "POST" });

export const apiExtendSession = (id: number, body: ExtendSessionBody) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/extend`, { method: "POST", body });

export interface ISessionItem {
  id: number;
  session_id: number;
  product_id: number | null;
  name: string;
  price: number | string;
  qty: number;
}

export interface IBillBreakdown {
  mode: "fixed" | "open";
  elapsed_minutes: number;
  time_cost: number;
  hourly_rate: number | null;
  package_name: string | null;
  items: Array<{ id: number; name: string; price: number; qty: number; line_total: number }>;
  items_total: number;
  total: number;
}

export interface AddItemBody {
  product_id?: number;
  name?: string;
  price?: number;
  qty?: number;
}

export const apiPreviewSession = (id: number) =>
  request<{ preview: IBillBreakdown }>(`/sessions/${id}/preview`);

export const apiStopSessionWithBreakdown = (id: number) =>
  request<{ session: ISessionApi; breakdown: IBillBreakdown }>(`/sessions/${id}/stop`, { method: "POST" });

export const apiAddSessionItem = (id: number, body: AddItemBody) =>
  request<{ item: ISessionItem; session: ISessionApi }>(`/sessions/${id}/items`, { method: "POST", body });

export const apiRemoveSessionItem = (sessionId: number, itemId: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/items/${itemId}`, { method: "DELETE" });

export const apiListPcs = (branchId: number) =>
  request<{ data: IPcApi[] }>("/pcs", { params: { branch_id: branchId } });

export const apiListPackages = (branchId: number) =>
  request<{ data: ITimePackage[] }>("/time-packages", { params: { branch_id: branchId } });
