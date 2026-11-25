import { can } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthContext";
import BonusSettingsForm from "@/components/bonus/BonusSettingsForm";
import TimeBonusSettingsForm from "@/components/bonus/TimeBonusSettingsForm";
import RegisterBonusDialog from "@/components/bonus/RegisterBonusDialog";
import Button from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { useState } from "react";
import { useParams } from "react-router-dom";

/**
 * «Бонусные карты» of one branch (2026-11-25): the owner's rule on top, the
 * branch's cards below with a phone filter, and «Зарегистрировать игрока».
 */
const BonusCards = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [applied, setApplied] = useState("");
  const [registering, setRegistering] = useState(false);
  const settings = useAsync(() => bonusRepository.settings(id), [id]);
  const list = useAsync(() => bonusRepository.list(id, applied || undefined), [id, applied]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const runSearch = () => { if (phone === applied) void list.reload(); else setApplied(phone); };
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

      {settings.data && can(user?.role, "branch.bonusSettings") && (
        <section className="card col" style={{ gap: 10, padding: 16 }}>
          <h3 style={{ margin: 0 }}>{t("bonus.settings.title")}</h3>
          <BonusSettingsForm branchId={id} settings={settings.data} onSaved={() => void settings.reload()} />
        </section>
      )}
      {settings.data?.time_bonus && can(user?.role, "branch.bonusSettings") && (
        <section className="card col" style={{ gap: 10, padding: 16 }}>
          <h3 style={{ margin: 0 }}>{t("timeBonus.settings.title")}</h3>
          <span className="muted" style={{ fontSize: 13 }}>{t("timeBonus.settings.lead")}</span>
          <TimeBonusSettingsForm branchId={id} settings={settings.data.time_bonus} onSaved={() => void settings.reload()} />
        </section>
      )}
      {settings.data && !enabled && <div className="muted">{t("bonus.disabledHint")}</div>}

      <div className="row" style={{ gap: 6 }}>
        <input className="input" inputMode="tel" placeholder={t("bonus.searchPhone")} value={phone}
          onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} data-testid="bonus-search" />
        <Button variant="secondary" onClick={runSearch}>{t("action.search")}</Button>
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
                <div className="name">{a.name || t("bonus.noName")}</div>
                <div className="meta">{a.phone}</div>
              </div>
              <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>{t("bonus.balance").replace("{0}", money(Number(a.balance)))}</div>
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
