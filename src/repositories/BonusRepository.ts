import {
  apiListBranchNews, apiPostBranchNews, apiRemoveBranchNews, type BranchNewsBody,
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
  apiRemoveBonusAccount,
  apiSessionBonusCard,
  apiUpdateTimeBonusSettings,
  apiUpdateRankSettings,
  RegisterBonusBody,
  UpdateRankSettingsBody,
  UpdateBonusSettingsBody,
  UpdateTimeBonusBody,
  apiFreezeBonusAccount,
  apiSetBonusRank,
  apiRateBonusAccount,
  apiBonusRateDue,
} from "@/api/bonus";
import { friendlyMutation } from "@/api/fallback";
import type { Rank, RateVisit } from "@/types/bonus";

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
  sessionCard(sessionId: number) { return apiSessionBonusCard(sessionId).then((r) => r.account); }
  remove(branchId: number, id: number) { return friendlyMutation(apiRemoveBonusAccount(branchId, id)); }
  /** The owner's hand on a card and the club's stars for the player (2026-11-26). */
  freeze(branchId: number, id: number, frozen: boolean) { return friendlyMutation(apiFreezeBonusAccount(branchId, id, frozen).then((r) => r.account)); }
  setRank(branchId: number, id: number, rank: Rank | null) { return friendlyMutation(apiSetBonusRank(branchId, id, rank).then((r) => r.account)); }
  rate(branchId: number, id: number, body: RateVisit) { return friendlyMutation(apiRateBonusAccount(branchId, id, body).then((r) => r.account)); }
  /** The players to rate after a visit (2026-11-27). */
  rateDue() { return apiBonusRateDue().then((r) => r.data); }
  lookup(branchId: number, code: string) { return friendlyMutation(apiLookupBonusCode(branchId, code)); }
  register(branchId: number, b: RegisterBonusBody) { return friendlyMutation(apiRegisterBonusAccount(branchId, b).then((r) => r.account)); }
  bind(sessionId: number, accountId: number | null) { return friendlyMutation(apiBindBonusAccount(sessionId, accountId)); }
  updateRanks(branchId: number, b: UpdateRankSettingsBody) { return friendlyMutation(apiUpdateRankSettings(branchId, b).then((r) => r.settings)); }
  updateTimeBonus(branchId: number, b: UpdateTimeBonusBody) { return friendlyMutation(apiUpdateTimeBonusSettings(branchId, b).then((r) => r.time_bonus)); }
  pendingTimeBonus() { return apiPendingTimeBonus().then((r) => r.data); }
  /** The branch's news (2026-11-25): posting it tells every card holder. */
  news(branchId: number) { return apiListBranchNews(branchId).then((r) => r.data); }
  postNews(branchId: number, b: BranchNewsBody) { return friendlyMutation(apiPostBranchNews(branchId, b).then((r) => r.news)); }
  removeNews(branchId: number, id: number) { return friendlyMutation(apiRemoveBranchNews(branchId, id)); }
  grantTimeBonus(winId: number) { return friendlyMutation(apiGrantTimeBonus(winId).then((r) => r.session)); }
  declineTimeBonus(winId: number) { return friendlyMutation(apiDeclineTimeBonus(winId)); }
}

export const bonusRepository = new BonusRepository();
