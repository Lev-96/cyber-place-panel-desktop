import ClockInput from "@/components/sessions/ClockInput";
import { clockOfDraft, type ClockDraft } from "@/components/sessions/durationModel";
import { useLang } from "@/i18n/LanguageContext";
import { useState } from "react";

interface Props {
  /** "13:00", or "" while not set. */
  from: string;
  to: string;
  /** Called with "HH:MM", or "" while a field is empty or not a time. */
  onChange: (from: string, to: string) => void;
  disabled?: boolean;
  testId?: string;
}

const draftOf = (hhmm: string): ClockDraft => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? { hours: m[1], minutes: m[2] } : { hours: "", minutes: "" };
};

/**
 * Hours of the day for a Club Card rule (2026-11-25, owner: as clear as the
 * other time fields): «С [ 13 ] : [ 00 ]  до [ 18 ] : [ 00 ]» — the same large
 * clock field Start uses, no ":" to type, ↑/↓ to step.
 */
const HoursRange = ({ from, to, onChange, disabled = false, testId = "hours-range" }: Props) => {
  const { t } = useLang();
  const [a, setA] = useState<ClockDraft>(() => draftOf(from));
  const [b, setB] = useState<ClockDraft>(() => draftOf(to));
  const emit = (na: ClockDraft, nb: ClockDraft) => onChange(clockOfDraft(na) ?? "", clockOfDraft(nb) ?? "");

  return (
    <div className="hours-range" data-testid={testId}>
      <div className="hours-range__end">
        <span className="hours-range__label">{t("timeBonus.settings.from")}</span>
        <ClockInput value={a} onChange={(n) => { setA(n); emit(n, b); }} label={t("timeBonus.settings.from")}
          invalidText={t("session.untilInvalid")} disabled={disabled} testId={`${testId}-from`} />
      </div>
      <span className="hours-range__dash" aria-hidden>—</span>
      <div className="hours-range__end">
        <span className="hours-range__label">{t("timeBonus.settings.to")}</span>
        <ClockInput value={b} onChange={(n) => { setB(n); emit(a, n); }} label={t("timeBonus.settings.to")}
          invalidText={t("session.untilInvalid")} disabled={disabled} testId={`${testId}-to`} />
      </div>
    </div>
  );
};

export default HoursRange;
