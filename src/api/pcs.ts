import { IPcApi } from "@/types/sessions";
import { request } from "./client";

export interface CreatePcBody {
  branch_id: number;
  place_id?: number | null;
  label: string;
  mac_address?: string | null;
}

export interface UpdatePcBody {
  place_id?: number | null;
  label?: string;
  mac_address?: string | null;
}

export const apiListPcsForBranch = (branchId: number) =>
  request<{ data: IPcApi[] }>("/pcs", { params: { branch_id: branchId } });

export const apiCreatePc = (body: CreatePcBody) =>
  request<{ pc: IPcApi }>("/pcs", { method: "POST", body });

export const apiUpdatePc = (id: number, body: UpdatePcBody) =>
  request<{ pc: IPcApi }>(`/pcs/${id}`, { method: "PUT", body });

export const apiDeletePc = (id: number) =>
  request<{ message: string }>(`/pcs/${id}`, { method: "DELETE" });

export const apiRotatePcToken = (id: number) =>
  request<{ pc: IPcApi }>(`/pcs/${id}/rotate-token`, { method: "POST" });

export interface WakeResult {
  message: string;
  mac?: string;
  sent_packets?: number;
  errors?: string[];
  note?: string;
}

export const apiWakePc = (id: number) =>
  request<WakeResult>(`/pcs/${id}/wake`, { method: "POST" });
