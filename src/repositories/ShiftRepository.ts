import { apiCloseShift, apiCurrentShift, apiListShifts, apiOpenShift, apiShiftSummary } from "@/api/shifts";
import { friendlyMutation } from "@/api/fallback";
import { IShift, IShiftWithReport } from "@/types/shifts";

/**
 * The branch's cash shifts. Reads are NOT wrapped in a fallback: a money
 * record that silently reads as empty when the request failed says "no shift"
 * or "nothing taken" — the screen shows the error instead.
 */
export class ShiftRepository {
  current(branchId: number) {
    return apiCurrentShift(branchId);
  }
  list(branchId: number): Promise<IShift[]> {
    return apiListShifts(branchId).then((r) => r.data);
  }
  summary(shiftId: number): Promise<IShiftWithReport> {
    return apiShiftSummary(shiftId);
  }
  open(branchId: number, openingCash: string): Promise<IShift> {
    return friendlyMutation(apiOpenShift(branchId, openingCash).then((r) => r.shift));
  }
  close(shiftId: number, countedCash: string, notes: string) {
    return friendlyMutation(apiCloseShift(shiftId, countedCash, notes));
  }
}

export const shiftRepository = new ShiftRepository();
