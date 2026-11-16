import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import type { IDbNotification } from "@/api/notifications";
import { sessionRepository } from "@/repositories/SessionRepository";
import { playFor } from "@/sound/soundEngine";
import { notify } from "@/ui/notify";
import { durationLabel } from "@/utils/durationLabel";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * "The player asked to be reminded" (2026-11-15, owner) — a floating card for
 * every staff member the SERVER told (`session.reminder`,
 * `SessionReminderService` → `SessionReminderDue`: the branch's staff, owners
 * per their `sessions` switch, and always the person who set it).
 *
 * The SessionEndingNotifier idiom, deliberately: the card IS the server's
 * notification, so nothing here decides when a reminder is due; it arrives
 * with the list (on start, over Reverb, after a reconnect). The bell is the
 * ending-soon one (`playFor("session_ending", id)`), once per notification.
 * Dismissing is remembered per user in localStorage, so a restart does not
 * bring it back.
 *
 *  - «Понятно»: read, and the seat's reminder cleared on the server;
 *  - «Ещё 30 мин»: the same reminder again in 30 minutes;
 *  - «Открыть место»: the branch's board.
 */

const TYPE = "session.reminder";
const MAX_CARDS = 3;
const SNOOZE_MINUTES = 30;

export interface ReminderCard {
  id: string;
  sessionId: number;
  branchId: number;
  seat: string;
  player: string | null;
  note: string | null;
  minutes: number | null;
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** The cards to show now: unread, not dismissed, once each, newest last. */
export const reminderCards = (list: readonly IDbNotification[], dismissed: ReadonlySet<string>): ReminderCard[] =>
  list
    .filter((n, i, all) => all.findIndex((m) => m.id === n.id) === i)
    .filter((n) => n.data?.type === TYPE && n.read_at === null && !dismissed.has(n.id))
    .map((n) => ({
      id: n.id,
      sessionId: Number(n.data.session_id),
      branchId: Number(n.data.branch_id),
      seat: n.data.place_number != null ? String(n.data.place_number) : String(n.data.pc_id ?? n.data.session_id),
      player: text(n.data.player_name),
      note: text(n.data.note),
      minutes: typeof n.data.minutes === "number" ? n.data.minutes : null,
    }));

const storageKey = (userId: number) => `cp.reminder.dismissed.${userId}`;

const readDismissed = (userId: number): Set<string> => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
};

const writeDismissed = (userId: number, ids: Set<string>) => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids].slice(-200)));
  } catch {
    /* storage blocked: dismissing still works for this run */
  }
};

/** "Seat №3 (Арам): the player asked to be reminded, 2 h have passed" — named tokens, any order per language. */
export const reminderSentence = (c: Pick<ReminderCard, "seat" | "player" | "minutes">, t: (k: string) => string): string =>
  t("session.reminder.cardBody").replace(/\{(\w+)\}/g, (m, k: string) => ({
    seat: c.seat,
    player: c.player ? ` (${c.player})` : "",
    elapsed: c.minutes !== null ? durationLabel(c.minutes, t) : "-",
  } as Record<string, string>)[k] ?? m);

const SessionReminderNotifier = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { list, markRead } = useNotifications();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId !== null) setDismissed(readDismissed(userId));
  }, [userId]);

  const cards = useMemo(() => reminderCards(list, dismissed).slice(0, MAX_CARDS), [list, dismissed]);

  useEffect(() => {
    for (const c of cards) playFor("session_ending", c.id);
  }, [cards]);

  const dismiss = (id: string) => {
    setDismissed((cur) => {
      const next = new Set(cur).add(id);
      if (userId !== null) writeDismissed(userId, next);
      return next;
    });
  };

  const gotIt = async (c: ReminderCard) => {
    dismiss(c.id);
    void markRead(c.id).catch(() => { /* the list re-reads on its own */ });
    try {
      await sessionRepository.clearReminder(c.sessionId);
    } catch {
      /* the seat may have ended or been cleared elsewhere: nothing to undo */
    }
  };

  const snooze = async (c: ReminderCard) => {
    dismiss(c.id);
    void markRead(c.id).catch(() => {});
    try {
      await sessionRepository.setReminder(c.sessionId, SNOOZE_MINUTES, c.note ?? undefined);
      notify.message("success", t("session.reminder.snoozedToast"));
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : String(e));
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="ending-soon-stack reminder-stack" data-testid="reminder-stack">
      {cards.map((c) => (
        <div key={c.id} role="alert" aria-live="assertive" className="ending-soon-card reminder-card">
          <div className="reminder-card__title">🔔 {t("session.reminder.cardTitle")}</div>
          <div className="reminder-card__body">{reminderSentence(c, t)}</div>
          {c.note && <div className="reminder-card__note">«{c.note}»</div>}
          <div className="reminder-card__actions">
            <button type="button" className="ending-soon-card__action" onClick={() => void gotIt(c)}>
              {t("session.reminder.ok")}
            </button>
            <button type="button" className="ending-soon-card__action is-secondary" onClick={() => void snooze(c)}>
              {t("session.reminder.snooze")}
            </button>
            <button type="button" className="ending-soon-card__action is-secondary" onClick={() => navigate(`/branches/${c.branchId}/sessions`)}>
              {t("session.reminder.open")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SessionReminderNotifier;
