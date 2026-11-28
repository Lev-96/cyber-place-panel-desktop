import BonusSettingsForm from "@/components/bonus/BonusSettingsForm";
import RankSettingsForm from "@/components/bonus/RankSettingsForm";
import TimeBonusSettingsForm from "@/components/bonus/TimeBonusSettingsForm";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { useParams } from "react-router-dom";

/**
 * «Настройки бонусной карты» (2026-11-25, owner): every Club Card rule of a
 * branch in one place, apart from the branch's prices — the bonus percent
 * and its hours, the welcome bonus, ranks, and the time bonus with its seats.
 * Owner and admin only (`branch.bonusSettings`); the server checks again.
 */
const BonusSettings = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const settings = useAsync(() => bonusRepository.settings(id), [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;
  const s = settings.data;
  const reload = () => void settings.reload();

  return (
    <div className="col" style={{ gap: 18 }} data-testid="bonus-settings-page">
      <h2 className="page-title" style={{ margin: 0 }}>{t("hub.tile.bonusSettings")}</h2>
      {settings.error && <div className="error">{t("bonus.state.errorTitle")}</div>}
      {!s && !settings.error && <ListSkeleton />}
      {s && (
        <>
          <section className="card col" style={{ gap: 10, padding: 16 }}>
            <h3 style={{ margin: 0 }}>{t("bonus.settings.title")}</h3>
            <BonusSettingsForm branchId={id} settings={s} onSaved={reload} />
          </section>
          {s.rank && (
            <section className="card col" style={{ gap: 10, padding: 16 }}>
              <h3 style={{ margin: 0 }}>{t("bonus.rank.title")}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{t("bonus.rank.lead")}</span>
              <RankSettingsForm branchId={id} settings={s.rank} onSaved={reload} />
            </section>
          )}
          {s.time_bonus && (
            <section className="card col" style={{ gap: 10, padding: 16 }}>
              <h3 style={{ margin: 0 }}>{t("timeBonus.settings.title")}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{t("timeBonus.settings.lead")}</span>
              <TimeBonusSettingsForm branchId={id} settings={s.time_bonus} onSaved={reload} />
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default BonusSettings;
