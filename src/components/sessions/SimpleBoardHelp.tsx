import StatusChip from "@/components/ui/StatusChip";
import { useLang } from "@/i18n/LanguageContext";

/**
 * What the colours on the board mean, said once at the top (2026-10-27) — in
 * the Simple interface only, for someone who has never used the panel. Pure
 * text: nothing here does anything.
 */
const SimpleBoardHelp = () => {
  const { t } = useLang();
  return (
    <div className="simple-board-help" data-testid="simple-board-help">
      <span className="simple-board-help__title">{t("session.simpleHelp.title")}</span>
      <StatusChip tone="free" label={t("session.simpleHelp.free")} />
      <StatusChip tone="playing" label={t("session.simpleHelp.playing")} />
      <StatusChip tone="ending" label={t("session.simpleHelp.ending")} />
      <StatusChip tone="paused" label={t("session.simpleHelp.paused")} />
      <StatusChip tone="offline" label={t("session.simpleHelp.offline")} />
    </div>
  );
};

export default SimpleBoardHelp;
