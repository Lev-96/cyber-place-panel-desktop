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

export const apiChangePassword = (body: { current_password: string; new_password: string; new_password_confirmation: string }) =>
  request<void>("/change-password", { method: "PUT", body });

/** Confirm the current password server-side (before revealing new-password fields). */
export const apiVerifyPassword = (current_password: string) =>
  request<{ valid: boolean }>("/verify-password", { method: "POST", body: { current_password } });

/** Email change: send a one-time code to the CURRENT email for the given new address. */
export const apiSendEmailChangeCode = (email: string) =>
  request<{ message: string }>("/email/change/send-code", { method: "POST", body: { email } });

/** Email change: confirm the code and bind the new address. */
export const apiConfirmEmailChange = (code: string) =>
  request<{ message: string; email: string }>("/email/change/confirm", { method: "POST", body: { code } });

/** Password change (forgot flow): mail a one-time code to the account email. */
export const apiSendPasswordCode = () =>
  request<{ message: string }>("/password/change/send-code", { method: "POST", body: {} });

/** Password change: verify the code (no side effects) before revealing the new-password fields. */
export const apiVerifyPasswordCode = (code: string) =>
  request<{ valid: boolean }>("/password/change/verify-code", { method: "POST", body: { code } });

/** Password change: confirm the code and set the new password. */
export const apiConfirmPasswordChange = (body: { code: string; new_password: string; new_password_confirmation: string }) =>
  request<{ message: string }>("/password/change/confirm", { method: "POST", body });

/*
 * Reset the password of an account nobody is signed in as (an owner
 * recovering a manager's password). Same one-time-CODE email as the
 * signed-in change above — not the link-based /forgot-password flow the
 * login screen uses. The code is mailed to the account's OWN address.
 */
export const apiSendPasswordResetCode = (email: string) =>
  request<{ message: string }>("/password/reset-code/send", { method: "POST", body: { email } });

export const apiVerifyPasswordResetCode = (email: string, code: string) =>
  request<{ valid: boolean }>("/password/reset-code/verify", { method: "POST", body: { email, code } });

export const apiConfirmPasswordResetCode = (body: {
  email: string;
  code: string;
  new_password: string;
  new_password_confirmation: string;
}) => request<{ message: string }>("/password/reset-code/confirm", { method: "POST", body });
