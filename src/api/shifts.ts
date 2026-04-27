import { IShift, IShiftSummary } from "@/types/shifts";
import { request } from "./client";

export const apiCurrentShift = (branchId: number) =>
  request<{ shift: IShift | null; summary: IShiftSummary | null }>("/shifts/current", { params: { branch_id: branchId } });

export const apiListShifts = (branchId: number) =>
  request<{ data: IShift[] }>("/shifts", { params: { branch_id: branchId } });

export const apiOpenShift = (branchId: number, openingCash: number) =>
  request<{ shift: IShift }>("/shifts/open", { method: "POST", body: { branch_id: branchId, opening_cash: openingCash } });

export const apiCloseShift = (id: number, declaredCash?: number, notes?: string) =>
  request<{ shift: IShift; summary: IShiftSummary }>(`/shifts/${id}/close`, {
    method: "POST",
    body: { declared_cash: declaredCash, notes },
  });

export const apiShiftSummary = (id: number) =>
  request<{ shift: IShift; summary: IShiftSummary }>(`/shifts/${id}/summary`);
