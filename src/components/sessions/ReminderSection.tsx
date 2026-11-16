import Button from "@/components/ui/Button";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { ISessionApi } from "@/types/sessions";
import { durationLabel } from "@/utils/durationLabel";
import { useState } from "react";
import DurationInput from "./DurationInput";
import { EMPTY_DRAFT, draftMinutes, isDraftEmpty, type DurationDraft } from "./durationModel";

/**
 * The server's bounds (`SetReminderRequest`): 1..600 minutes — the same 10 h
 * ceiling as every length (`draftMinutes` reads past it as unreadable) — and
 * a note of up to 120.
 */
export const REMINDER_NOTE_MAX = 120;

interface Props {
  session: ISessionApi;
  disabled: boolean;
  /** The dialog's own runner: keeps the server's answer, shows its refusal. */
  run: (action: () => Promise<ISessionApi>, attemptedMinutes?: number | null, successToast?: string | null) => Promise<boolean>;
  t: (k: string) => string;
}

/** 24-hour wall clock. */
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * «Напоминание» in «+ Время» (2026-11-15, owner): "remind me in two hours".
 *
 * The same h:mm field as every other length here, an optional name or note,
 * and one button that says what it will do («Напомнить через 2 ч»). Once set,
 * the section says when it rings (the server's `reminder.at`) and offers to
 * change or cancel it; once rung, that it rang. Wall clock: it rings during a
 * pause too. The server decides everything — this only asks.
 */
const ReminderSection = ({ session, disabled, run, t }: Props) => {
  const reminder = session.reminder ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DurationDraft>(EMPTY_DRAFT);
  const [note, setNote] = useState("");
  const minutes = draftMinutes(draft);
  // Typed but unreadable: past the 10 h ceiling (the field takes digits only).
  const tooLong = !isDraftEmpty(draft) && minutes === null;
  const valid = minutes !== null && minutes >= 1;
  const showForm = reminder === null || editing;

  const set = async () => {
    if (!valid || minutes === null) return;
    const ok = await run(
      () => sessionRepository.setReminder(session.id, minutes, note),
      null,
      fmt(t("session.reminder.setToast"), durationLabel(minutes, t)),
    );
    if (ok) { setEditing(false); setDraft(EMPTY_DRAFT); }
  };

  const clear = async () => {
    const ok = await run(() => sessionRepository.clearReminder(session.id), null, t("session.reminder.clearedToast"));
    if (ok) { setEditing(false); setNote(""); setDraft(EMPTY_DRAFT); }
  };

  return (
    <section className="col reminder-section" data-testid="reminder-section">
      <strong>🔔 {t("session.reminder.title")}</strong>
      {reminder !== null && !editing && (
        <div className={`reminder-pending${reminder.fired_at ? " is-fired" : ""}`} data-testid="reminder-pending">
          <span className="reminder-pending__when">
            {reminder.fired_at
              ? fmt(t("session.reminder.fired"), clock(reminder.fired_at))
              : fmt(t("session.reminder.pending"), clock(reminder.at))}
          </span>
          {reminder.note && <span className="reminder-pending__note">«{reminder.note}»</span>}
          <div className="row reminder-pending__actions">
            <Button
              variant="secondary"
              disabled={disabled}
              data-testid="reminder-change"
              onClick={() => { setEditing(true); setNote(reminder.note ?? ""); }}
            >
              {t("session.reminder.change")}
            </Button>
            <Button variant="secondary" className="is-danger" disabled={disabled} data-testid="reminder-cancel" onClick={() => { void clear(); }}>
              {t(reminder.fired_at ? "session.reminder.dismiss" : "session.reminder.cancel")}
            </Button>
          </div>
        </div>
      )}
      {showForm && (
        <>
          {reminder === null && <span className="muted reminder-section__hint">{t("session.reminder.hint")}</span>}
          <DurationInput
            value={draft}
            onChange={setDraft}
            disabled={disabled}
            label={t("session.reminder.length")}
            testId="reminder-duration"
          />
          {tooLong && <span className="error" style={{ fontSize: 12 }} data-testid="reminder-too-long">{t("session.reminder.tooLong")}</span>}
          <label className="col" style={{ gap: 4 }}>
            <span className="label">{t("session.reminder.note")}</span>
            <input
              className="input"
              type="text"
              value={note}
              maxLength={REMINDER_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("session.reminder.notePlaceholder")}
              disabled={disabled}
              data-testid="reminder-note"
            />
          </label>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button disabled={disabled || !valid} data-testid="reminder-set" onClick={() => { void set(); }}>
              {fmt(t("session.reminder.set"), durationLabel(minutes ?? 0, t))}
            </Button>
            {editing && (
              <Button variant="secondary" disabled={disabled} onClick={() => setEditing(false)}>{t("action.cancel")}</Button>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default ReminderSection;
