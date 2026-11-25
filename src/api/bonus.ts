import type { IBonusAccount, IBonusLookup, IBonusSettings, ITimeBonusSettings, ITimeBonusWin, RankStrategy, RankThresholds } from "@/types/bonus";
import type { ISessionApi } from "@/types/sessions";
import { request } from "./client";

/** No `code`: a player without a smartphone, opened by phone (2026-11-25). */
export interface RegisterBonusBody { code?: string; name?: string | null; phone: string }
export interface UpdateBonusSettingsBody {
  enabled: boolean; percent: number; welcome: number;
  /** The earning hours (2026-11-25): both or neither (null = every hour). */
  earn_from?: string | null; earn_to?: string | null;
}
export interface UpdateRankSettingsBody {
  strategy: RankStrategy; thresholds?: RankThresholds;
  /** The owner's names; an empty one = the standard name (2026-11-25). */
  names?: Partial<Record<"gamer" | "pro" | "elite" | "veteran" | "legend", string>>;
}

export const apiUpdateRankSettings = (branchId: number, body: UpdateRankSettingsBody) =>
  request<{ settings: IBonusSettings }>(`/branches/${branchId}/bonus-rank-settings`, { method: "PUT", body });

export const apiBonusSettings = (branchId: number) =>
  request<{ settings: IBonusSettings }>(`/branches/${branchId}/bonus-settings`);

export const apiUpdateBonusSettings = (branchId: number, body: UpdateBonusSettingsBody) =>
  request<{ settings: IBonusSettings }>(`/branches/${branchId}/bonus-settings`, { method: "PUT", body });

export const apiListBonusAccounts = (branchId: number, phone?: string) =>
  request<{ data: IBonusAccount[] }>(`/branches/${branchId}/bonus-accounts`, { params: phone ? { phone } : undefined });

export const apiGetBonusAccount = (branchId: number, accountId: number) =>
  request<{ account: IBonusAccount }>(`/branches/${branchId}/bonus-accounts/${accountId}`);

export const apiLookupBonusCode = (branchId: number, code: string) =>
  request<IBonusLookup>(`/branches/${branchId}/bonus-accounts/lookup`, { params: { code } });

export const apiRegisterBonusAccount = (branchId: number, body: RegisterBonusBody) =>
  request<{ account: IBonusAccount }>(`/branches/${branchId}/bonus-accounts`, { method: "POST", body });

export const apiBindBonusAccount = (sessionId: number, bonusAccountId: number | null) =>
  request<{ session_id: number; bonus_account_id: number | null }>(`/sessions/${sessionId}/bonus-account`, {
    method: "PUT",
    body: { bonus_account_id: bonusAccountId },
  });

/** The time bonus (2026-11-25). */
export interface UpdateTimeBonusBody { enabled: boolean; from: string; to: string; minutes: number; per_window: number; place_ids?: number[] | null }

export const apiUpdateTimeBonusSettings = (branchId: number, body: UpdateTimeBonusBody) =>
  request<{ time_bonus: ITimeBonusSettings }>(`/branches/${branchId}/time-bonus-settings`, { method: "PUT", body });

export const apiPendingTimeBonus = () => request<{ data: ITimeBonusWin[] }>("/time-bonus/pending");

export const apiGrantTimeBonus = (winId: number) =>
  request<{ session: ISessionApi }>(`/time-bonus/${winId}/grant`, { method: "POST" });

export const apiDeclineTimeBonus = (winId: number) =>
  request<{ declined: true }>(`/time-bonus/${winId}/decline`, { method: "POST" });
