import type { IStartQuote } from "@/api/sessions";
import { formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import ClockInput from "./ClockInput";
import { clockOfDraft, isDraftEmpty, type ClockDraft } from "./durationModel";

/**
 * "Until" a clock time at start (2026-10-26): "[ 14 ] : [ 30 ]" since
 * 2026-11-05, no ":" to type (`ClockInput`). How long that is and whether it
 * is tomorrow is the server's answer (`quote`), shown as soon as it comes:
 * "50 min · until 00:40 (tomorrow)". Nothing is worked out from this
 * machine's clock.
 */
interface Props {
  value: ClockDraft;
  onChange: (next: ClockDraft) => void;
  disabled?: boolean;
  /** The server's answer for exactly this time, or null while there is none. */
  quote: IStartQuote | null;
}

/** Whether `iso` falls on a later calendar day than `now`, on this machine's calendar. */
export const isNextDay = (iso: string, now: Date = new Date()): boolean => {
  const end = new Date(iso);
  const day = (d: Date) => d.getFullYear() * 10_000 + d.getMonth() * 100 + d.getDate();
  return day(end) > day(now);
};

const ClockTimeField = ({ value, onChange, disabled = false, quote }: Props) => {
  const { t } = useLang();
  const settled = clockOfDraft(value) !== null;

  return (
    <div className="col" style={{ gap: 8 }} data-testid="planned-until">
      <span className="muted" style={{ fontSize: 12 }}>{t("session.untilLabel")}</span>
      <ClockInput
        value={value}
        onChange={onChange}
        label={t("session.untilLabel")}
        invalidText={t("session.untilInvalid")}
        disabled={disabled}
        testId="planned-until-input"
      />
      {/* One line at a time: how to type it while empty, the server's answer once set. */}
      {isDraftEmpty(value) && <span className="muted" style={{ fontSize: 11 }}>{t("session.untilHint")}</span>}
      {settled && quote?.ends_at && (
        <span style={{ fontSize: 13 }} data-testid="planned-until-resolved">
          {fmt(t(isNextDay(quote.ends_at) ? "session.untilResolvedTomorrow" : "session.untilResolved"), quote.minutes, formatTime(quote.ends_at))}
        </span>
      )}
    </div>
  );
};

export default ClockTimeField;
