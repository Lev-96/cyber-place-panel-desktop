import { useLang } from "@/i18n/LanguageContext";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global "new update available" toast. Sits in the top-right corner
 * regardless of which route the user is on, plays a soft two-note
 * ding via Web Audio API the first time each version is seen, and
 * goes silent forever once the user dismisses it for that version.
 *
 * Why no audio file: a synthesised sine-wave ding is ~30 lines, has
 * no playback latency (no fetch), zero filesystem footprint, and
 * does not need a copyright clearance check. The downside is no
 * branding, which is fine for a transient notification.
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

/**
 * Soft two-note "ding". Bails silently if the AudioContext API
 * isn't available (e.g. an old preload mock during tests). Wrapped
 * in try/catch so a missing user gesture on a hostile WebView
 * doesn't surface as an uncaught promise rejection.
 */
const playDing = (): void => {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const note = (freq: number, when: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.18, when + 0.02);
      gain.gain.linearRampToValueAtTime(0, when + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + dur);
    };
    note(660, now,        0.18);
    note(880, now + 0.13, 0.22);
    // Close the context after the second tone so we don't leak it
    // across many toasts in a long-running session.
    setTimeout(() => { void ctx.close().catch(() => { /* ignore */ }); }, 600);
  } catch {
    /* sound is non-essential — toast still renders */
  }
};

const UpdatesToast = () => {
  const { panel, agent } = useUpdatesNotification();
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
      playDing();

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
    navigate(active.app === "panel" ? "/settings/updates" : "/settings/agent-updates");
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
