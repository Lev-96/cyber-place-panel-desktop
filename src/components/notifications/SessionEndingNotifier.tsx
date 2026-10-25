import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import type { IDbNotification } from "@/api/notifications";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { useEffect, useMemo, useState } from "react";
import SessionOptionsDialog from "@/components/sessions/SessionOptionsDialog";

/**
 * "This seat is about to run out" — a floating card for every staff member the
 * SERVER told (2026-10-25).
 *
 * It used to run its own clock: poll the active sessions every 30 s and warn at
 * 10 minutes, while the server warned at 15 and wrote that warning to the
 * notifications list. Two clocks, two thresholds, and a desktop that showed the
 * server's warning only as a badge — so a manager at the panel saw a count and
 * had to open Notifications to find out which seat. Now the card IS the
 * server's notification (`session.ending_soon`, `SessionEndingSoonService`):
 * the same recipients (owner and the branch's managers, by the server's
 * scope), the same moment, the same row the list shows. It arrives with the
 * list — on start, over Reverb, after a reconnect — so nothing here decides
 * when a seat is ending.
 *
 * Shown once per notification: dismissing it is remembered for this user (a
 * per-device convenience in localStorage), so a reconnect or a restart does not
 * bring it back; an unread warning not yet dismissed comes back after a
 * restart, because it still stands. Marked read or deleted in the list, it
 * goes. Gone too once the seat's end has passed. Several seats are stacked.
 */

const TYPE = "session.ending_soon";
const MAX_CARDS = 3;
const TICK_MS = 30_000;

export interface EndingWarning {
  id: string;
  sessionId: number;
  branchId: number;
  label: string;
  minutesLeft: number;
}

/** The warnings to show now: unread, still ahead, not dismissed — soonest first. */
export const endingWarnings = (
  list: readonly IDbNotification[],
  dismissed: ReadonlySet<string>,
  now: number,
): EndingWarning[] =>
  list
    // One card per notification, even if a replay put the row in twice.
    .filter((n, i, all) => all.findIndex((m) => m.id === n.id) === i)
    .filter((n) => n.data?.type === TYPE && n.read_at === null && !dismissed.has(n.id))
    .map((n) => {
      const endsAt = n.data.ends_at ? Date.parse(n.data.ends_at) : NaN;
      return {
        id: n.id,
        sessionId: Number(n.data.session_id),
        branchId: Number(n.data.branch_id),
        label: n.data.place_number != null ? `№${n.data.place_number}` : `#${n.data.pc_id ?? n.data.session_id}`,
        minutesLeft: Number.isNaN(endsAt) ? Number(n.data.minutes_left ?? 0) : Math.ceil((endsAt - now) / 60_000),
        endsAt,
      };
    })
    .filter((w) => (Number.isNaN(w.endsAt) ? w.minutesLeft > 0 : w.endsAt > now))
    .sort((a, b) => a.minutesLeft - b.minutesLeft)
    .map(({ endsAt: _endsAt, ...w }) => w);

const storageKey = (userId: number) => `cp.endingSoon.dismissed.${userId}`;

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
    // The last 200 are plenty: older warnings are long past their seat's end.
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids].slice(-200)));
  } catch {
    /* private window / storage blocked: dismissing still works for this run */
  }
};

const SessionEndingNotifier = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { list } = useNotifications();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [managing, setManaging] = useState<ISessionApi | null>(null);

  // Keyed on the id, not the object: a re-created user object (a refreshed
  // profile) must not re-read storage and re-render in a loop.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId !== null) setDismissed(readDismissed(userId));
  }, [userId]);

  // Only to drop a card whose seat has run out and refresh "N min" — the
  // warning itself is the server's, never decided here.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const warnings = useMemo(
    () => endingWarnings(list, dismissed, now).slice(0, MAX_CARDS),
    [list, dismissed, now],
  );

  const dismiss = (id: string) => {
    setDismissed((cur) => {
      const next = new Set(cur).add(id);
      if (user) writeDismissed(user.id, next);
      return next;
    });
  };

  const manage = async (w: EndingWarning) => {
    dismiss(w.id);
    try {
      const sessions = await sessionRepository.listActiveEverywhere();
      const found = sessions.find((s) => s.id === w.sessionId);
      if (found) setManaging(found);
    } catch {
      /* the seat cannot be read now; the board still has it */
    }
  };

  const dialog = managing === null ? null : (
    <SessionOptionsDialog
      session={managing}
      platform={managing.place_platform}
      onClose={() => setManaging(null)}
      onChanged={setManaging}
    />
  );

  if (warnings.length === 0) return dialog;

  return (
    <>
      <div className="ending-soon-stack" data-testid="ending-soon-stack">
        {warnings.map((w) => (
          <div key={w.id} role="alert" aria-live="assertive" className="ending-soon-card">
            <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>⚠️ {t("session.endingSoonTitle")}</div>
              <button
                type="button"
                onClick={() => dismiss(w.id)}
                aria-label={t("session.endingSoonDismiss")}
                title={t("session.endingSoonDismiss")}
                className="ending-soon-card__close"
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {t("session.endingSoonBody")
                .replace("{place}", w.label)
                .replace("{minutes}", String(Math.max(1, w.minutesLeft)))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => void manage(w)} className="ending-soon-card__action">
                {t("session.endingSoonAction")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {dialog}
    </>
  );
};

export default SessionEndingNotifier;
