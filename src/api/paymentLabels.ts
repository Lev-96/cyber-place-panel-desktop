import { request } from "@/api/client";

/** A «Свой вариант» name a branch has paid with (`GET /branches/{id}/payment-labels`, 2026-11-18). */
export interface IPaymentLabel {
  label: string;
  uses: number;
}

/** Most used first; read fresh, a name used a minute ago is offered. */
export const apiPaymentLabels = (branchId: number): Promise<{ data: IPaymentLabel[] }> =>
  request<{ data: IPaymentLabel[] }>(`/branches/${branchId}/payment-labels`, { noCache: true });
