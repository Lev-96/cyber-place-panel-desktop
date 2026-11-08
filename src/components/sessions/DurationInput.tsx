import TwoBoxField from "@/components/ui/TwoBoxField";
import { useLang } from "@/i18n/LanguageContext";
import {
  MAX_DURATION_MINUTES, draftMinutes, settleDuration, stepDraft, typeIntoHours, typeIntoMinutes, type DurationDraft,
} from "./durationModel";

/**
 * A length as a time field shows it (2026-11-05, owner): "[ 1 ] ч : [ 30 ] мин",
 * the shared `TwoBoxField` with the length rules of `durationModel`:
 *  - "1", then a space / ":" / "ч" → on to the minutes ("1 30" is 1 h 30 min);
 *  - no single digit jumps on (a "3" may be the start of "30мин"); a number
 *    past 10 h in the hours ("30", "90") is minutes (30 min, 1 h 30 min);
 *  - "1ч 30мин", "1:30", "1.30", "90 мин" typed or pasted → both boxes;
 *    "1.5" is 1 h 30 min too (laid out once the field is left);
 *  - the letters of "мин" / "час" typed after the digits are ignored;
 *  - "75" in the minutes → 1 h 15 min; ↑ / ↓ → an hour, or five minutes.
 *
 * Empty is "no length"; what that means is the caller's to say. The price is
 * the caller's (the server's quote).
 */
interface Props {
  value: DurationDraft;
  onChange: (next: DurationDraft) => void;
  /** The field's accessible name. */
  label: string;
  disabled?: boolean;
  /** The longest length accepted; default the session ceiling (600 min). */
  maxMinutes?: number;
  /** Said under a value that is not accepted; default `session.timeInvalid`. */
  invalidText?: string;
  testId?: string;
}

const DurationInput = ({
  value, onChange, label, disabled = false, maxMinutes = MAX_DURATION_MINUTES, invalidText, testId,
}: Props) => {
  const { t } = useLang();
  return (
    <TwoBoxField
      value={value}
      onChange={onChange}
      label={label}
      isValid={(d) => draftMinutes(d, maxMinutes) !== null}
      typeIntoHours={(text, d) => typeIntoHours(text, d, maxMinutes)}
      typeIntoMinutes={(text, d) => typeIntoMinutes(text, d, maxMinutes)}
      step={(d, box, dir) => stepDraft(d, box, dir, maxMinutes)}
      settle={(d) => settleDuration(d, maxMinutes)}
      hoursLabel={`${label}: ${t("session.timeUnitHours")}`}
      minutesLabel={`${label}: ${t("session.timeUnitMinutes")}`}
      hoursUnit={t("time.hourShort")}
      minutesUnit={t("time.minShort")}
      hoursPlaceholder="0"
      minutesPlaceholder="00"
      clearLabel={t("session.durationClear")}
      invalidText={invalidText ?? t("session.timeInvalid")}
      inputMode="text"
      disabled={disabled}
      testId={testId}
    />
  );
};

export default DurationInput;
