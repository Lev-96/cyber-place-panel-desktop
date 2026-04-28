import { AuthUser, Role } from "@/types/api";
import { request } from "./client";

interface LoginResponseRaw {
  login: { id: number; name: string; email: string; role: Role };
  token: string;
  messages?: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export const apiLogin = async (email: string, password: string): Promise<LoginResult> => {
  const res = await request<LoginResponseRaw>("/session/login", {
    method: "POST",
    body: { email, password },
  });
  return {
    token: res.token,
    user: { id: res.login.id, name: res.login.name, email: res.login.email, role: res.login.role },
  };
};

export const apiGetMe = () => request<{ user: AuthUser }>("/user/me");

export const apiForgotPassword = (email: string) =>
  request<void>("/forgot-password", { method: "POST", body: { email } });

export const apiResetPassword = (body: { token: string; new_password: string; new_password_confirmation: string }) =>
  request<void>("/reset-password", { method: "PUT", body });
