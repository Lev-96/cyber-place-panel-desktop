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
  const fake = (label: string, extra = "") => (
    <span className={`btn secondary session-card__btn ${extra}`} aria-hidden>{label}</span>
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
            <div className="session-card__more">{fake(`${t("session.card.more")} ▾`, "session-card__btn--wide")}</div>
          ) : (
            <>
              {fake(t("session.pause"))}
              {fake(t("session.card.relocate"), "session-card__btn--wide")}
            </>
          )}
          {fake(t("action.stop"), "session-card__btn--wide is-danger")}
        </div>
      ) : (
        <div className="session-card__foot"><span className="btn session-card__start" aria-hidden>{t("action.start")}</span></div>
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
