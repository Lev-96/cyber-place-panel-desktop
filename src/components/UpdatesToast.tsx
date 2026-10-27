import { playFor } from "@/sound/soundEngine";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global "new update available" toast. Sits in the top-right corner
 * regardless of which route the user is on, sounds the "system" kind of
 * notification (the soft two-note ding by default; `sound/soundEngine.ts`,
 * 2026-10-27) the first time each version is seen, and goes silent
 * forever once the user dismisses it for that version.
 *
 * Why version-keyed dismissal: if the user closes the toast for
 * v1.0.X they don't want to see it again on the next 60s poll. But
 * when v1.0.(X+1) lands, the toast should reappear — they haven't
 * seen this one yet.
 */

const DISMISS_KEY_PREFIX = "cp.update-toast-dismissed-";
const AUTO_DISMISS_MS = 12_000;

interface ActiveToast {
  app: "panel" | "agent";
  version: string;
}

const UpdatesToast = () => {
  const { panel, agent } = useUpdatesNotification();
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const seenRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ActiveToast | null>(null);

  useEffect(() => {
    // Build the candidate list in priority order (panel first since
    // admins act on it more often). Skip anything we've already
    // surfaced or that the user has explicitly dismissed.
    const candidates: ActiveToast[] = [];
    if (panel?.has_update && panel.available?.version) {
      candidates.push({ app: "panel", version: panel.available.version });
    }
    if (agent?.has_update && agent.available?.version) {
      candidates.push({ app: "agent", version: agent.available.version });
    }

    for (const c of candidates) {
      const key = `${c.app}-${c.version}`;
      if (seenRef.current.has(key)) continue;
      const dismissed = localStorage.getItem(DISMISS_KEY_PREFIX + key);
      if (dismissed) { seenRef.current.add(key); continue; }

      seenRef.current.add(key);
      setActive(c);
      // The update ding, as the person set it (2026-10-27).
      playFor("system", `update:${key}`);

      // Auto-dismiss after a few seconds. The timer is scoped to
      // THIS toast — if a newer toast arrives mid-countdown, the
      // setter compares identity and leaves the new one alone.
      const targetApp = c.app;
      const targetVer = c.version;
      setTimeout(() => {
        setActive((curr) =>
          curr && curr.app === targetApp && curr.version === targetVer
            ? null
            : curr,
        );
      }, AUTO_DISMISS_MS);
      break; // one toast at a time
    }
  }, [panel, agent]);

  if (!active) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + `${active.app}-${active.version}`, "1");
    setActive(null);
  };

  const goToSection = () => {
    dismiss();
    // Admin's unified updates screen lists both panel + agent rows;
    // owner/manager have a dedicated agent-only screen and no
    // visibility into the panel app. Routing per role prevents the
    // RoleGuard from bouncing admin away from a forbidden agent-only
    // path when they click a toast about an agent release.
    const target =
      user?.role === "admin" ? "/settings/updates" : "/settings/agent-updates";
    navigate(target);
  };

  const messageKey =
    active.app === "panel" ? "updates.toastPanel" : "updates.toastAgent";

  return (
    <div
      className="cp-update-toast"
      role="status"
      aria-live="polite"
      onClick={goToSection}
    >
      <div className="cp-update-toast-emoji">🎉</div>
      <div className="cp-update-toast-body">
        <div className="cp-update-toast-title">{t("updates.toastTitle")}</div>
        <div className="cp-update-toast-message">{t(messageKey)}</div>
        <div className="cp-update-toast-cta">{t("updates.toastCta")}</div>
      </div>
      <button
        type="button"
        className="cp-update-toast-close"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        aria-label={t("action.close")}
      >
        ✕
      </button>
    </div>
  );
};

export default UpdatesToast;
