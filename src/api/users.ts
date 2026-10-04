import { Role } from "@/types/api";
import { request } from "./client";

export interface IRegisteredUser {
  id: number;
  name: string;
  email: string;
  role?: Role;
  created_at?: string;
  updated_at?: string;
}

export const apiUpdateUser = (id: number, body: { name: string; email: string }) =>
  request<{ messages?: string }>(`/users/${id}`, { method: "PUT", body });

export const apiGetUser = (id: number) =>
  request<{ User: IRegisteredUser & { email_verified_at?: string | null; role?: string } }>(`/users/${id}`);
