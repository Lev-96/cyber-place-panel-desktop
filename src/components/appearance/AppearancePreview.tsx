import { SessionCardAction } from "@/components/sessions/SessionCard";
import Button from "@/components/ui/Button";
import { StatusIcon } from "@/components/ui/StatusChip";
import { useLang } from "@/i18n/LanguageContext";

/**
 * A picture of the sessions board in the look being chosen (2026-10-27).
 *
 * Drawn with the board's own classes, so density, card size, the «Ещё» fold,
 * secondary detail and the theme all show here exactly as they will there.
 * It is a picture and nothing more: its buttons have no handlers and are out
 * of the tab order, it reads no data and sends nothing — choosing a look can
 * never start a seat, sell a drink or wake a console.
 */
const Card = ({ tone, number, status, rate, quick }: {
  tone: "playing" | "free" | "ending"; number: number; status: string; rate?: string; quick: "all" | "primary";
}) => {
  const { t } = useLang();
  const accent = `rgb(var(--status-${tone}-rgb))`;
  const running = tone !== "free";
  // The board's own button components, so the preview lays out exactly as
  // the board does (2026-10-27: plain spans did not, and their words sat
  // outside their frames). No onClick, out of the tab order, and the whole
  // picture is `inert`: nothing here can be pressed.
  const fake = (label: string, extra: { wide?: boolean; danger?: boolean } = {}) => (
    <SessionCardAction label={label} fullLabel={label} tabIndex={-1} type="button" {...extra} />
  );
  return (
    <div
      className={`place-cell session-card ${running ? "session-card--running" : "session-card--idle session-card--seat-free"}`}
      style={{ borderColor: accent, "--card-accent": accent } as React.CSSProperties}
    >
      <span className="session-card__stripe" aria-hidden />
      <span className="session-card__state" aria-hidden><StatusIcon tone={tone} /></span>
      <span className="platform" style={{ marginLeft: 0 }}>PC · STANDARD</span>
      <span className="id cell-line">№{number}</span>
      <span className="status">{status}</span>
      {running && rate && <span className="until"><span className="session-card__secondary">{rate}</span></span>}
      {running ? (
        <div className="session-card__actions">
          {fake(t("session.card.addItem"))}
          {quick === "primary" ? (
            <div className="session-card__more">{fake(`${t("session.card.more")} ▾`, { wide: true })}</div>
          ) : (
            <>
              {fake(t("session.pause"))}
              {fake(t("session.card.relocate"), { wide: true })}
            </>
          )}
          {fake(t("action.stop"), { danger: true })}
        </div>
      ) : (
        <div className="session-card__foot">
          <Button type="button" className="session-card__start" tabIndex={-1}>{t("action.start")}</Button>
        </div>
      )}
    </div>
  );
};

const AppearancePreview = ({ quick }: { quick: "all" | "primary" }) => {
  const { t } = useLang();
  return (
    <div className="appearance-preview" aria-label={t("appearance.preview")} role="img" data-testid="appearance-preview">
      <div className="live-grid live-grid--sessions" inert>
        <Card tone="playing" number={1} status="01:24:10" rate="800 / ч · план 1 600" quick={quick} />
        <Card tone="ending" number={2} status="00:04:12" rate="1 500 / ч" quick={quick} />
        <Card tone="free" number={3} status={t("session.free")} quick={quick} />
      </div>
    </div>
  );
};

export default AppearancePreview;
