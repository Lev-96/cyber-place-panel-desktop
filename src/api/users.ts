import { Role } from "@/types/api";
import { request } from "./client";

export interface RegisterUserBody {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface IRegisteredUser {
  id: number;
  name: string;
  email: string;
  role?: Role;
  created_at?: string;
  updated_at?: string;
}

export const apiRegisterUser = (body: RegisterUserBody) =>
  request<{ register: IRegisteredUser; token: string; messages?: string }>("/users", { method: "POST", body });

export const apiUpdateUser = (id: number, body: { name: string; email: string }) =>
  request<{ messages?: string }>(`/users/${id}`, { method: "PUT", body });

export const apiGetUser = (id: number) =>
  request<{ User: IRegisteredUser & { email_verified_at?: string | null; role?: string } }>(`/users/${id}`);
