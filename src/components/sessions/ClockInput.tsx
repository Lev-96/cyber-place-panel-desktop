import TwoBoxField from "@/components/ui/TwoBoxField";
import { useLang } from "@/i18n/LanguageContext";
import {
  clockOfDraft, settleClock, stepClock, typeIntoClockHours, typeIntoClockMinutes, type ClockDraft,
} from "./durationModel";

/**
 * A time of day as a time field shows it (2026-11-05, owner): "[ 14 ] : [ 30 ]",
 * 24-hour, with no ":" to type — the shared `TwoBoxField` with the clock rules
 * of `durationModel`:
 *  - "1430" → 14:30, "0040" → 00:40, "930" → 09:30;
 *  - "3"…"9" in the hour is that hour, and the minutes are next ("9" → 09);
 *  - "14:30", "14.30", "14 30" typed or pasted → both boxes;
 *  - ↑ / ↓ → an hour, or five minutes, round the clock;
 *  - left, it is written out in full ("9", "5" → 09:05).
 *
 * Empty is "no time"; what that means is the caller's to say. When the time
 * falls and how long until it is the server's answer, never this machine's.
 */
interface Props {
  value: ClockDraft;
  onChange: (next: ClockDraft) => void;
  /** The field's accessible name. */
  label: string;
  invalidText: string;
  disabled?: boolean;
  testId?: string;
}

const ClockInput = ({ value, onChange, label, invalidText, disabled = false, testId }: Props) => {
  const { t } = useLang();
  return (
    <TwoBoxField
      value={value}
      onChange={onChange}
      label={label}
      isValid={(d) => clockOfDraft(d) !== null}
      typeIntoHours={typeIntoClockHours}
      typeIntoMinutes={typeIntoClockMinutes}
      step={stepClock}
      settle={settleClock}
      padsMinutes
      hoursLabel={`${label}: ${t("session.timeUnitHours")}`}
      minutesLabel={`${label}: ${t("session.timeUnitMinutes")}`}
      hoursPlaceholder="00"
      minutesPlaceholder="00"
      clearLabel={t("session.untilClear")}
      invalidText={invalidText}
      disabled={disabled}
      testId={testId}
    />
  );
};

export default ClockInput;
