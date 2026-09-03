import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * "This seat runs out in ten minutes — do you want to sell them more?"
 *
 * ## Why it lives in the panel and not on the server
 *
 * There is no scheduler and no queue worker on this deployment
 * (`SCHEDULER_ENABLED` / `QUEUE_WORKER_ENABLED` are both off), so a backend
 * cron for "ten minutes left" would be a job that never runs. Nothing here
 * needs one: the panel already knows every session it may see and their end
 * times, and the people who have to act on the warning are the ones sitting in
 * front of it.
 *
 * ## How it stays addressed to the right people
 *
 * `GET /sessions?status=active` with no `branch_id` returns exactly the
 * caller's own venues — the branch scope is applied server-side. An admin
 * therefore sees the platform, an owner their company, a manager their branch,
 * and nobody is told about a seat that is not theirs. There is no filtering to
 * get wrong on this side because there is nothing to filter.
 *
 * ## And how it stays quiet
 *
 * One warning per session, ever, per panel session — `warned` is the whole
 * duplicate-suppression mechanism, and it is deliberately never cleared for a
 * session that is still running. Granting more time pushes `ends_at` out, the
 * session leaves the window, and the operator is NOT warned again ten minutes
 * later for a decision they already made. A session that ends and a new one
 * that starts on the same seat has a new id and warns on its own merits.
 *
 * The card does not auto-dismiss. A booking toast that fades is a missed
 * booking somebody can still find in the list; a seat that goes dark under a
 * player is not recoverable after the fact.
 */

/** How close to the end the warning fires. */
const WARN_AT_MINUTES = 10;

/** How often the sessions are re-read. Same cadence as the board's own poll. */
const POLL_MS = 30_000;

interface Warning {
  sessionId: number;
  branchId: number;
  label: string;
  minutesLeft: number;
}

const minutesLeft = (endsAt: string, now: number): number =>
  Math.ceil((new Date(endsAt).getTime() - now) / 60_000);

/**
 * The sessions that just entered the window, given what has already been
 * warned about. Exported for the unit test: the rule ("about to end, has an
 * end at all, not already warned") is the whole feature, and it is worth
 * asserting without mounting React or faking a clock in a DOM.
 */
export const sessionsToWarnAbout = (
  sessions: ISessionApi[],
  warned: ReadonlySet<number>,
  now: number,
): Warning[] =>
  sessions
    .filter((s) => s.status === "active")
    // A session with no end cannot run out: it was started in count-up mode,
    // or an operator has already lifted its ceiling. `is_unlimited` is checked
    // too, so an older backend that only nulls `ends_at` behaves the same.
    .filter((s) => s.ends_at !== null && s.is_unlimited !== true)
    .filter((s) => !warned.has(s.id))
    .map((s) => ({
      sessionId: s.id,
      branchId: s.branch_id,
      label: s.pc_label || `#${s.pc_id}`,
      minutesLeft: minutesLeft(s.ends_at as string, now),
    }))
    // Already over is not a warning, it is news — the board turns the tile
    // over on its own and there is nothing left to sell.
    .filter((w) => w.minutesLeft > 0 && w.minutesLeft <= WARN_AT_MINUTES);

const SessionEndingNotifier = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = useState<Warning | null>(null);
  // Never cleared while the panel is open: one warning per session, ever.
  const warned = useRef<Set<number>>(new Set());

  const check = useCallback(async () => {
    // The endpoint is staff-only; without an account there is nothing to ask.
    if (!user) return;
    let sessions: ISessionApi[];
    try {
      sessions = await sessionRepository.listActiveEverywhere();
    } catch {
      // A blip must not take the shell down. The next tick tries again.
      return;
    }

    const due = sessionsToWarnAbout(sessions, warned.current, Date.now());
    if (due.length === 0) return;

    // Soonest first, so the one with the least time left is the one shown.
    due.sort((a, b) => a.minutesLeft - b.minutesLeft);
    for (const w of due) warned.current.add(w.sessionId);
    setWarning(due[0]);
  }, [user]);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(timer);
  }, [check]);

  if (!warning) return null;

  const openBoard = () => {
    navigate(`/branches/${warning.branchId}/sessions`);
    setWarning(null);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        // Below the booking toast rather than on top of it: two notifications
        // about different things must not hide one another.
        top: 96,
        right: 16,
        zIndex: 9000,
        maxWidth: 360,
        borderRadius: 8,
        background: "rgba(120, 90, 10, 0.96)",
        borderLeft: "4px solid #facc15",
        padding: "12px 14px",
        boxShadow: "0 6px 22px rgba(0, 0, 0, 0.35)",
        color: "#fef3c7",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>⚠️ {t("session.endingSoonTitle")}</div>
        <button
          type="button"
          onClick={() => setWarning(null)}
          aria-label={t("session.endingSoonDismiss")}
          title={t("session.endingSoonDismiss")}
          style={{
            border: "none",
            background: "transparent",
            color: "#fef3c7",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        {t("session.endingSoonBody")
          .replace("{place}", warning.label)
          .replace("{minutes}", String(warning.minutesLeft))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={openBoard}
          style={{
            padding: "4px 10px",
            border: "1px solid rgba(254, 243, 199, 0.35)",
            borderRadius: 6,
            background: "transparent",
            color: "#fef3c7",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {t("session.endingSoonAction")}
        </button>
      </div>
    </div>
  );
};

export default SessionEndingNotifier;
