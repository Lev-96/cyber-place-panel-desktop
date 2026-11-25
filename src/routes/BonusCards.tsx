import { can } from "@/auth/permissions";
import { bonusAmountText } from "@/components/bonus/bonusAmount";
import { useAuth } from "@/auth/AuthContext";
import RankBadge from "@/components/bonus/RankBadge";
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
          {(list.data ?? []).map((a) => (
            <div key={a.id} className="list-item">
              <div>
                <div className="name row" style={{ gap: 8, alignItems: "center" }}>{a.name || t("bonus.noName")} <RankBadge rank={a.rank} label={settings.data?.rank?.names?.[a.rank ?? "gamer"]} /></div>
                <div className="meta">{a.phone}</div>
              </div>
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>{t("bonus.balance").replace("{0}", bonusAmountText(money, a.balance))}</div>
                <Button type="button" variant="secondary" disabled={removing === a.id} onClick={() => void remove(a)} data-testid={`bonus-remove-${a.id}`}>
                  {t("bonus.remove.button")}
                </Button>
              </div>
            </div>
          ))}
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
