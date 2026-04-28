import { request } from "./client";

export const apiSubscribe = (email: string) =>
  request<{ message: string }>("/subscribe", { method: "POST", body: { email } });

export const apiUnsubscribe = (id: number) =>
  request<{ message: string }>(`/subscribe/${id}`, { method: "DELETE" });
