import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";
import { request } from "./client";

export interface StartSessionBody {
  branch_id: number;
  pc_id: number;
  package_id: number;
  user_display_name?: string;
}

export interface ExtendSessionBody {
  package_id: number;
}

/* When the backend's `/sessions`, `/pcs`, `/time-packages` migrations are
   not yet deployed, repositories return `[]` via api/fallback (orFallback). */

export const apiListActiveSessions = (branchId: number) =>
  request<{ data: ISessionApi[] }>("/sessions", { params: { branch_id: branchId, status: "active" } });

export const apiStartSession = (body: StartSessionBody) =>
  request<{ session: ISessionApi }>("/sessions", { method: "POST", body });

export const apiStopSession = (id: number) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/stop`, { method: "POST" });

export const apiExtendSession = (id: number, body: ExtendSessionBody) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/extend`, { method: "POST", body });

export const apiListPcs = (branchId: number) =>
  request<{ data: IPcApi[] }>("/pcs", { params: { branch_id: branchId } });

export const apiListPackages = (branchId: number) =>
  request<{ data: ITimePackage[] }>("/time-packages", { params: { branch_id: branchId } });
