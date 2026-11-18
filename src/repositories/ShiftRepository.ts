import {
  apiAcceptanceProducts, apiCloseShift, apiCurrentShift, apiListShifts, apiOpenShift, apiShiftStaff, apiShiftSummary,
} from "@/api/shifts";
import { friendlyMutation, orFallback } from "@/api/fallback";
import type {
  IAcceptanceProduct, IOpenShiftResult, IShiftStaff, IShiftWithReport, OpenShiftBody, ShiftHistoryFilters,
} from "@/types/shifts";

/**
 * The branch's cash shifts. Reads are NOT wrapped in a fallback: a money
 * record that silently reads as empty when the request failed says "no shift"
 * or "nothing taken" — the screen shows the error instead.
 */
export class ShiftRepository {
  current(branchId: number) {
    return apiCurrentShift(branchId);
  }
  list(filters: ShiftHistoryFilters) {
    return apiListShifts(filters);
  }
  staff(branchId: number): Promise<IShiftStaff[]> {
    return apiShiftStaff(branchId).then((r) => r.data);
  }
  summary(shiftId: number): Promise<IShiftWithReport> {
    return apiShiftSummary(shiftId);
  }
  /**
   * What must be counted to open a shift. A backend from before the count
   * (404) has nothing to count: the shift opens as it always did there.
   */
  acceptanceProducts(branchId: number): Promise<IAcceptanceProduct[]> {
    return orFallback(apiAcceptanceProducts(branchId).then((r) => r.data), []);
  }
  open(body: OpenShiftBody): Promise<IOpenShiftResult> {
    return friendlyMutation(apiOpenShift(body));
  }
  close(shiftId: number, countedCash: string, notes: string) {
    return friendlyMutation(apiCloseShift(shiftId, countedCash, notes));
  }
}

export const shiftRepository = new ShiftRepository();
