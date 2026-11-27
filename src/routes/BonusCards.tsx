import { can } from "@/auth/permissions";
import { bonusAmountText } from "@/components/bonus/bonusAmount";
import { useAuth } from "@/auth/AuthContext";
import RankBadge from "@/components/bonus/RankBadge";
import StarRating from "@/components/bonus/StarRating";
import { tagLabel } from "@/components/bonus/ratingTags";
import { compactCount } from "@/components/bonus/ratingFormat";
import { RANKS, type IBonusAccount, type IRating, type Rank } from "@/types/bonus";
import RegisterBonusDialog from "@/components/bonus/RegisterBonusDialog";
import Button from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { useState } from "react";
import FixedDialPhoneInput from "@/components/ui/FixedDialPhoneInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { notify } from "@/ui/notify";
import { Link, useParams } from "react-router-dom";

/**
 * «Бонусные карты» of one branch (2026-11-25): the branch's cards with a
 * phone filter and their ranks, and «Зарегистрировать игрока». The rules live
 * on their own page, «Настройки бонусной карты» (owner).
 */
const BonusCards = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();
  const { user } = useAuth();
  // Found as the number is typed (2026-11-25, owner): no «Найти».
  const [phone, setPhone] = useState("");
  const applied = useDebouncedValue(phone, 300);
  const [registering, setRegistering] = useState(false);
  // Owner and manager remove a card (2026-11-25, owner): asked first; the
  // money records stay; the player's app loses the card.
  const ask = useConfirm();
  const [removing, setRemoving] = useState<number | null>(null);
  const remove = async (a: { id: number; name: string | null; phone: string; balance: string }) => {
    const question = t("bonus.remove.confirm").replace("{0}", a.name || a.phone).replace("{1}", bonusAmountText(money, a.balance));
    if (!(await ask(question, { destructive: true, confirmLabel: t("bonus.remove.button") }))) return;
    setRemoving(a.id);
    try {
      await bonusRepository.remove(id, a.id);
      notify.message("success", t("bonus.remove.done"));
      void list.reload();
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : String(e));
    } finally {
      setRemoving(null);
    }
  };
  // The owner's hand on a card (2026-11-26, owner): freeze its bonuses,
  // lower its rank. Ratings are given after a visit (RatePlayerNotifier).
  const isOwner = can(user?.role, "branch.bonusSettings");
  const [acting, setActing] = useState<number | null>(null);
  const who = (a: IBonusAccount) => a.name || a.phone;
  const act = async (a: IBonusAccount, run: () => Promise<unknown>, done: string) => {
    setActing(a.id);
    try {
      await run();
      notify.message("success", done);
      void list.reload();
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  };
  const toggleFreeze = async (a: IBonusAccount) => {
    if (!a.frozen && !(await ask(t("bonus.freeze.confirm").replace("{0}", who(a)), { destructive: true, confirmLabel: t("bonus.freeze.button") }))) return;
    await act(a, () => bonusRepository.freeze(id, a.id, !a.frozen), t(a.frozen ? "bonus.unfreeze.done" : "bonus.freeze.done"));
  };
  const rankName = (r: Rank) => settings.data?.rank?.names?.[r] || t(`bonus.rank.${r}`);
  const changeRank = async (a: IBonusAccount, choice: string) => {
    if (choice === "auto") { await act(a, () => bonusRepository.setRank(id, a.id, null), t("bonus.rankAuto.done")); return; }
    const to = choice as Rank;
    if (!(await ask(t("bonus.rankLower.confirm").replace("{0}", who(a)).replace("{1}", rankName(to)), { destructive: true, confirmLabel: t("bonus.rankLower.label") }))) return;
    await act(a, () => bonusRepository.setRank(id, a.id, to), t("bonus.rankLower.done"));
  };
  const ratingText = (r: IRating | undefined, key: string, none: string) =>
    r && r.average !== null ? t(key).replace("{0}", r.average).replace("{1}", compactCount(r.count)) : t(none);
  const settings = useAsync(() => bonusRepository.settings(id), [id]);
  const list = useAsync(() => bonusRepository.list(id, applied || undefined), [id, applied]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const view = deriveViewState({ loading: list.loading, error: list.error, data: list.data, hasFilters: applied.trim() !== "" });
  const enabled = settings.data?.enabled ?? false;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("bonus.title")}</h2>
        <Button onClick={() => setRegistering(true)} disabled={!enabled} title={enabled ? undefined : t("bonus.disabledHint")} data-testid="bonus-register-open">
          {t("bonus.register.title")}
        </Button>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {can(user?.role, "branch.bonusSettings") && (
          <Link to={`/branches/${id}/bonus/settings`} className="btn secondary" data-testid="bonus-settings-link">
            {t("hub.tile.bonusSettings")}
          </Link>
        )}
        <Link to={`/branches/${id}/bonus/news`} className="btn secondary" data-testid="bonus-news-link">{t("hub.tile.news")}</Link>
      </div>
      {settings.data && !enabled && <div className="muted">{t("bonus.disabledHint")}</div>}
      {settings.data?.rating && (
        <div className="bonus-club-rating" data-testid="bonus-club-rating">{ratingText(settings.data.rating, "bonus.rating.club", "bonus.rating.clubNone")}</div>
      )}

      <div className="bonus-phone-search">
        <FixedDialPhoneInput countryCode="AM" value={phone} onChange={setPhone}
          ariaLabel={t("bonus.searchPhone")} placeholder="91 123 456" testId="bonus-search" />
      </div>
      <StateSwitch
        view={view}
        skeleton={<ListSkeleton />}
        onRetry={() => void list.reload()}
        error={{ titleKey: "bonus.state.errorTitle" }}
        empty={{ titleKey: "bonus.state.emptyTitle", descriptionKey: "bonus.state.emptyDescription" }}
        noResults={{ descriptionKey: "bonus.state.noResultsDescription" }}
      >
        <div className="list" data-testid="bonus-list">
          {(list.data ?? []).map((a) => {
            const rank: Rank = a.rank ?? "gamer";
            const lower = RANKS.slice(0, RANKS.indexOf(rank));
            const busy = acting === a.id || removing === a.id;
            return (
              <div key={a.id} className={"list-item bonus-card-row" + (a.frozen ? " is-frozen" : "")} data-testid={`bonus-row-${a.id}`}>
                <div className="bonus-card-row__who">
                  <div className="name row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {a.name || t("bonus.noName")} <RankBadge rank={a.rank} label={settings.data?.rank?.names?.[rank]} />
                    {a.rank_held && <span className="bonus-chip" data-testid={`bonus-rank-held-${a.id}`}>{t("bonus.rankHeld")}</span>}
                    {a.frozen && <span className="bonus-chip bonus-chip--frozen" data-testid={`bonus-frozen-${a.id}`}>{t("bonus.frozen")}</span>}
                  </div>
                  <div className="meta">{a.phone}</div>
                  {a.player_rating && (
                    <div className="meta" data-testid={`bonus-player-rating-${a.id}`}>{ratingText(a.player_rating, "bonus.rating.player", "bonus.rating.playerNone")}</div>
                  )}
                  {/* Ratings are given after a visit only (2026-11-27, owner): shown here, given in the window. */}
                  {a.club_stars != null && (
                    <div className="row bonus-card-row__stars" title={a.club_comment ?? undefined}>
                      <span className="meta">{t("bonus.rating.yours")}</span>
                      <StarRating value={a.club_stars} label={t("bonus.rating.yours")} testId={`bonus-stars-${a.id}`} />
                      {a.club_comment && <span className="meta bonus-rated-by-player">«{a.club_comment}»</span>}
                    </div>
                  )}
                  {a.player_stars != null && (
                    <div className="row bonus-card-row__stars" data-testid={`bonus-player-stars-${a.id}`}>
                      <span className="meta">{t("bonus.rating.fromPlayer")}</span>
                      <StarRating value={a.player_stars} label={t("bonus.rating.fromPlayer")} />
                      {(a.player_tags ?? []).length > 0 && <span className="meta bonus-rated-by-player">{(a.player_tags ?? []).map((c) => tagLabel(t, c)).join(", ")}</span>}
                      {a.player_comment && <span className="meta bonus-rated-by-player">«{a.player_comment}»</span>}
                    </div>
                  )}
                </div>
                <div className="bonus-card-row__side">
                  <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>{t("bonus.balance").replace("{0}", bonusAmountText(money, a.balance))}</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isOwner && (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggleFreeze(a)} data-testid={`bonus-freeze-${a.id}`}>
                        {t(a.frozen ? "bonus.unfreeze.button" : "bonus.freeze.button")}
                      </Button>
                    )}
                    {isOwner && (lower.length > 0 || a.rank_held) && (
                      <select className="input bonus-card-row__rank" value="" disabled={busy} aria-label={t("bonus.rankLower.label")}
                        onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) void changeRank(a, v); }} data-testid={`bonus-rank-${a.id}`}>
                        <option value="">{t("bonus.rankLower.label")}</option>
                        {lower.map((r) => <option key={r} value={r}>{rankName(r)}</option>)}
                        {a.rank_held && <option value="auto">{t("bonus.rankLower.auto")}</option>}
                      </select>
                    )}
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void remove(a)} data-testid={`bonus-remove-${a.id}`}>
                      {t("bonus.remove.button")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </StateSwitch>
      {registering && (
        <RegisterBonusDialog branchId={id} onClose={() => setRegistering(false)}
          onSaved={() => { setRegistering(false); void list.reload(); }} />
      )}
    </div>
  );
};

export default BonusCards;
