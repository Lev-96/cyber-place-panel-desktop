import { apiCloseShift, apiCurrentShift, apiListShifts, apiOpenShift, apiShiftSummary } from "@/api/shifts";
import { friendlyMutation, orFallback } from "@/api/fallback";

export class ShiftRepository {
  current(branchId: number) {
    return orFallback(apiCurrentShift(branchId), { shift: null, summary: null });
  }
  list(branchId: number) {
    return orFallback(apiListShifts(branchId).then((r) => r.data), []);
  }
  open(branchId: number, cash: number) {
    return friendlyMutation(apiOpenShift(branchId, cash).then((r) => r.shift));
  }
  close(id: number, declared?: number, notes?: string) {
    return friendlyMutation(apiCloseShift(id, declared, notes));
  }
  summary(id: number) {
    return friendlyMutation(apiShiftSummary(id));
  }
}

export const shiftRepository = new ShiftRepository();
