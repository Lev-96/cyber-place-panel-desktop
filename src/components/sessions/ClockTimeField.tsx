import type { IStartQuote } from "@/api/sessions";
import { formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { clockOf } from "./durationModel";

/**
 * "Until" a clock time at start (2026-10-26): one box, "00:40".
 *
 * Text with `inputMode`, like the length box — Electron swallows keystrokes in
 * raw number/time inputs. The shape is checked here; how long that is and
 * whether it is tomorrow is the server's answer (`quote`), shown as soon as it
 * comes: "50 min · until 00:40 (tomorrow)". Nothing is worked out from this
 * machine's clock.
 */
interface Props {
  value: string;
  onChange: (next: string) => void;
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
  const invalid = value.trim() !== "" && clockOf(value) === null;

  return (
    <div className="col" style={{ gap: 6 }} data-testid="planned-until">
      <label className="row" style={{ gap: 8, alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("session.untilLabel")}</span>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="00:40"
          maxLength={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("session.untilLabel")}
          aria-invalid={invalid}
          disabled={disabled}
          style={{ width: 96 }}
        />
      </label>
      <span className="muted" style={{ fontSize: 11 }}>{t("session.untilHint")}</span>
      {invalid && <span className="error" style={{ fontSize: 12 }}>{t("session.untilInvalid")}</span>}
      {!invalid && quote?.ends_at && (
        <span style={{ fontSize: 13 }} data-testid="planned-until-resolved">
          {fmt(t(isNextDay(quote.ends_at) ? "session.untilResolvedTomorrow" : "session.untilResolved"), quote.minutes, formatTime(quote.ends_at))}
        </span>
      )}
    </div>
  );
};

export default ClockTimeField;
