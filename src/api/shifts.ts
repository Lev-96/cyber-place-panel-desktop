import { request } from "./client";
import { IShift, IShiftReport, IShiftWithReport } from "@/types/shifts";

/**
 * Cash shifts (2026-10-19). Live data: never cached (see httpCache), and the
 * close is answered with what the server froze — a second close returns the
 * first's result with `already_closed: true`.
 */
export const apiCurrentShift = (branchId: number) =>
  request<{ shift: IShift | null; report: IShiftReport | null }>("/shifts/current", { params: { branch_id: branchId } });

export const apiListShifts = (branchId: number, limit = 30) =>
  request<{ data: IShift[] }>("/shifts", { params: { branch_id: branchId, limit } });

export const apiShiftSummary = (shiftId: number) =>
  request<IShiftWithReport>(`/shifts/${shiftId}/summary`);

export const apiOpenShift = (branchId: number, openingCash: string) =>
  request<{ shift: IShift }>("/shifts/open", { method: "POST", body: { branch_id: branchId, opening_cash: openingCash } });

export const apiCloseShift = (shiftId: number, countedCash: string, notes: string) =>
  request<IShiftWithReport & { already_closed: boolean }>(`/shifts/${shiftId}/close`, {
    method: "POST",
    body: { counted_cash: countedCash, notes },
  });
