import { apiCloseShift, apiCurrentShift, apiListShifts, apiOpenShift, apiShiftSummary } from "@/api/shifts";

export class ShiftRepository {
  current(branchId: number) { return apiCurrentShift(branchId); }
  list(branchId: number) { return apiListShifts(branchId).then((r) => r.data); }
  open(branchId: number, cash: number) { return apiOpenShift(branchId, cash).then((r) => r.shift); }
  close(id: number, declared?: number, notes?: string) { return apiCloseShift(id, declared, notes); }
  summary(id: number) { return apiShiftSummary(id); }
}

export const shiftRepository = new ShiftRepository();
