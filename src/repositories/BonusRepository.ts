import {
  apiBindBonusAccount,
  apiBonusSettings,
  apiGetBonusAccount,
  apiListBonusAccounts,
  apiLookupBonusCode,
  apiRegisterBonusAccount,
  apiUpdateBonusSettings,
  apiDeclineTimeBonus,
  apiGrantTimeBonus,
  apiPendingTimeBonus,
  apiUpdateTimeBonusSettings,
  RegisterBonusBody,
  UpdateBonusSettingsBody,
  UpdateTimeBonusBody,
} from "@/api/bonus";
import { friendlyMutation } from "@/api/fallback";

/**
 * Cyber Place Club Card. Reads throw (the screen shows its error state, never
 * an empty list that hides a failure); writes go through friendlyMutation so a
 * server sentence reaches the operator.
 */
export class BonusRepository {
  settings(branchId: number) { return apiBonusSettings(branchId).then((r) => r.settings); }
  updateSettings(branchId: number, b: UpdateBonusSettingsBody) { return friendlyMutation(apiUpdateBonusSettings(branchId, b).then((r) => r.settings)); }
  list(branchId: number, phone?: string) { return apiListBonusAccounts(branchId, phone).then((r) => r.data); }
  account(branchId: number, id: number) { return apiGetBonusAccount(branchId, id).then((r) => r.account); }
  lookup(branchId: number, code: string) { return friendlyMutation(apiLookupBonusCode(branchId, code)); }
  register(branchId: number, b: RegisterBonusBody) { return friendlyMutation(apiRegisterBonusAccount(branchId, b).then((r) => r.account)); }
  bind(sessionId: number, accountId: number | null) { return friendlyMutation(apiBindBonusAccount(sessionId, accountId)); }
  updateTimeBonus(branchId: number, b: UpdateTimeBonusBody) { return friendlyMutation(apiUpdateTimeBonusSettings(branchId, b).then((r) => r.time_bonus)); }
  pendingTimeBonus() { return apiPendingTimeBonus().then((r) => r.data); }
  grantTimeBonus(winId: number) { return friendlyMutation(apiGrantTimeBonus(winId).then((r) => r.session)); }
  declineTimeBonus(winId: number) { return friendlyMutation(apiDeclineTimeBonus(winId)); }
}

export const bonusRepository = new BonusRepository();
