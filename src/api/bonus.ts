import type { IBonusAccount, IBonusLookup, IBonusSettings, ITimeBonusSettings, ITimeBonusWin, Rank, RateVisit, RankStrategy, RankThresholds } from "@/types/bonus";
import type { ISessionApi } from "@/types/sessions";
import { request } from "./client";

/** No `code`: a player without a smartphone, opened by phone (2026-11-25). */
export interface RegisterBonusBody {
  code?: string; name?: string | null; phone: string;
  /** Move this number's card from an earlier copy of the app (2026-11-26). */
  move?: boolean;
}
export interface UpdateBonusSettingsBody {
  enabled: boolean; percent: number; welcome: number;
  /** The earning hours (2026-11-25): both or neither (null = every hour). */
  earn_from?: string | null; earn_to?: string | null;
  /** A manager's gift caps (2026-11-28); sent only to a server that knows them. */
  manager_gift_max?: number; manager_gift_daily?: number;
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

/** The Club Card on a seat, or null (2026-11-25): a changed way of paying offers «Бонусы». */
export const apiSessionBonusCard = (sessionId: number) =>
  request<{ account: IBonusAccount | null }>(`/sessions/${sessionId}/bonus-account`);

/** The owner freezes / thaws a card's bonuses (2026-11-26). */
export const apiFreezeBonusAccount = (branchId: number, accountId: number, frozen: boolean) =>
  request<{ account: IBonusAccount }>(`/branches/${branchId}/bonus-accounts/${accountId}/freeze`, { method: "PUT", body: { frozen } });

/** The owner lowers a card's rank; `null` gives it back to the rule (2026-11-26). */
export const apiSetBonusRank = (branchId: number, accountId: number, rank: Rank | null) =>
  request<{ account: IBonusAccount }>(`/branches/${branchId}/bonus-accounts/${accountId}/rank`, { method: "PUT", body: { rank } });

/** The club rates the player after a visit, or «Не сейчас» (2026-11-27). */
export const apiRateBonusAccount = (branchId: number, accountId: number, body: RateVisit) =>
  request<{ account: IBonusAccount }>(`/branches/${branchId}/bonus-accounts/${accountId}/rating`, { method: "PUT", body });

/** The players the club is asked to rate after a visit, every branch this person works in (2026-11-27). */
export const apiBonusRateDue = () => request<{ data: IBonusAccount[] }>("/bonus-rate-due");

/** Owner / manager remove a card (2026-11-25): the money records stay. */
export const apiRemoveBonusAccount = (branchId: number, accountId: number) =>
  request<{ deleted: true }>(`/branches/${branchId}/bonus-accounts/${accountId}`, { method: "DELETE" });

/** A branch's news for its Club Card players (2026-11-25). */
export interface IBranchNews { id: number; title: string; body: string | null; image_path?: string | null; at: string | null }
/** `image`: an optional picture (2026-11-25); with one, the post goes as a form. */
export interface BranchNewsBody { title: string; body?: string | null; image?: File | null }

export const apiListBranchNews = (branchId: number) =>
  request<{ data: IBranchNews[] }>(`/branches/${branchId}/news`);

export const apiPostBranchNews = (branchId: number, body: BranchNewsBody) => {
  if (!body.image) {
    return request<{ news: IBranchNews }>(`/branches/${branchId}/news`, { method: "POST", body: { title: body.title, body: body.body ?? null } });
  }
  const fd = new FormData();
  fd.append("title", body.title);
  if (body.body) fd.append("body", body.body);
  fd.append("image", body.image);
  return request<{ news: IBranchNews }>(`/branches/${branchId}/news`, { method: "POST", body: fd });
};

export const apiRemoveBranchNews = (branchId: number, newsId: number) =>
  request<{ deleted: boolean }>(`/branches/${branchId}/news/${newsId}`, { method: "DELETE" });
