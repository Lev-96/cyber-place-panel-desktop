import { IMember, IMemberDeposit } from "@/types/members";
import { request } from "./client";

export interface CreateMemberBody {
  branch_id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  card_code?: string | null;
  notes?: string | null;
}

export type UpdateMemberBody = Partial<Omit<CreateMemberBody, "branch_id">> & { is_active?: boolean };

export const apiListMembers = (branchId: number, search?: string) =>
  request<{ data: IMember[] }>("/members", { params: { branch_id: branchId, search } });

export const apiGetMember = (id: number) =>
  request<{ member: IMember }>(`/members/${id}`);

export const apiCreateMember = (body: CreateMemberBody) =>
  request<{ member: IMember }>("/members", { method: "POST", body });

export const apiUpdateMember = (id: number, body: UpdateMemberBody) =>
  request<{ member: IMember }>(`/members/${id}`, { method: "PUT", body });

export const apiDeleteMember = (id: number) =>
  request<{ message: string }>(`/members/${id}`, { method: "DELETE" });

export const apiTopupMember = (id: number, amount: number, reference?: string) =>
  request<{ member: IMember; transaction: IMemberDeposit }>(`/members/${id}/topup`, {
    method: "POST",
    body: { amount, reference },
  });

export const apiAdjustMember = (id: number, amount: number, reference?: string) =>
  request<{ member: IMember; transaction: IMemberDeposit }>(`/members/${id}/adjust`, {
    method: "POST",
    body: { amount, reference },
  });

export const apiMemberDeposits = (id: number) =>
  request<{ data: IMemberDeposit[] }>(`/members/${id}/deposits`);
