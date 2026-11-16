import { fmt } from "@/i18n/translations";
import type { ISessionApi } from "@/types/sessions";

interface Props {
  session: ISessionApi;
  t: (k: string) => string;
  money: (n: number) => string;
}

/** 24-hour wall clock. */
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const reminderTitle = (at: string, t: (k: string) => string): string => fmt(t("session.reminder.pending"), clock(at));

/** A figure off the wire: JSON may send "1200.00" for 1200. */
const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

/**
 * What a running seat says at a glance since 2026-11-15, FIRST on the card's
 * one-line tariff line (every card is one height, so nothing here adds a
 * line): the player's reminder (🔔 time), products handed over NOT paid yet
 * (amber), then cash paid ahead (green). Every figure is the server's (`unpaid_items_total`,
 * `prepaid_amount`); nothing is added up here. Renders nothing when there is
 * nothing to say, so an ordinary card is unchanged.
 */
const SessionCardChips = ({ session, t, money }: Props) => {
  const unpaid = num(session.unpaid_items_total);
  const prepaid = num(session.prepaid_amount);
  const reminder = session.reminder ?? null;
  if (unpaid <= 0 && prepaid <= 0 && reminder === null) return null;
  return (
    <>
      {/* The reminder (2026-11-15): «🔔 20:40» while pending; once rung, said
          so in amber until somebody clears it. The note is the tooltip. */}
      {reminder !== null && (
        <span
          className={`pill session-card__pill session-chip session-chip--reminder${reminder.fired_at ? " is-fired" : ""}`}
          data-testid="card-reminder-chip"
          title={[reminderTitle(reminder.at, t), reminder.note].filter(Boolean).join(" · ")}
        >
          {`🔔 ${reminder.fired_at ? t("session.reminder.chipFired") : clock(reminder.at)}`}
        </span>
      )}
      {unpaid > 0 && (
        <span className="pill session-card__pill session-chip session-chip--unpaid" data-testid="card-unpaid-chip">
          {fmt(t("session.unpaidChip"), money(unpaid))}
        </span>
      )}
      {prepaid > 0 && (
        <span className="pill session-card__pill session-chip session-chip--prepaid" data-testid="card-prepaid-chip">
          {fmt(t("session.prepaidChip"), money(prepaid))}
        </span>
      )}
    </>
  );
};

export default SessionCardChips;
