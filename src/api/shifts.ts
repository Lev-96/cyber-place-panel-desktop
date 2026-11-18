import { request } from "./client";
import type {
  IAcceptanceProduct, IOpenShiftResult, IShift, IShiftReport, IShiftStaff, IShiftWithReport, IStockCountRequiredBody,
  OpenShiftBody, ShiftHistoryFilters,
} from "@/types/shifts";
import type { PaginatedList } from "@/types/api";

/**
 * Cash shifts (2026-10-19). Live data: never cached (see httpCache), and the
 * close is answered with what the server froze — a second close returns the
 * first's result with `already_closed: true`.
 */
export const apiCurrentShift = (branchId: number) =>
  request<{ shift: IShift | null; report: IShiftReport | null }>("/shifts/current", { params: { branch_id: branchId } });

/** The history, filtered and paged on the server; a manager gets their own shifts only. */
export const apiListShifts = (filters: ShiftHistoryFilters) =>
  request<PaginatedList<IShift>>("/shifts", { params: filters });

/** Who can be picked as the staff member for a branch's history. */
export const apiShiftStaff = (branchId: number) =>
  request<{ data: IShiftStaff[] }>("/shifts/staff", { params: { branch_id: branchId } });

export const apiShiftSummary = (shiftId: number) =>
  request<IShiftWithReport>(`/shifts/${shiftId}/summary`);

/**
 * «Приём смены» (2026-11-18): every product the branch counts, names only —
 * never a figure. Empty = the branch opens without a count.
 */
export const apiAcceptanceProducts = (branchId: number) =>
  request<{ data: IAcceptanceProduct[] }>("/shifts/acceptance-products", { params: { branch_id: branchId } });

/**
 * Open a shift. This build always sends `stock_counts` (empty when the branch
 * counts nothing) and the attempt's `client_request_id`: the same id again is
 * answered 200 + `replayed` with the shift it already opened.
 */
export const apiOpenShift = (body: OpenShiftBody) =>
  request<IOpenShiftResult>("/shifts/open", { method: "POST", body });

/** The 422 that names the products the count missed, or null for any other failure. */
export const stockCountRequiredBody = (e: unknown): IStockCountRequiredBody | null => {
  const err = e as { status?: number; body?: unknown } | null;
  const body = err?.body as Partial<IStockCountRequiredBody> | undefined;
  return err?.status === 422 && body?.code === "stock_count_required" && Array.isArray(body.missing)
    ? (body as IStockCountRequiredBody)
    : null;
};

export const apiCloseShift = (shiftId: number, countedCash: string, notes: string) =>
  request<IShiftWithReport & { already_closed: boolean }>(`/shifts/${shiftId}/close`, {
    method: "POST",
    body: { counted_cash: countedCash, notes },
  });
