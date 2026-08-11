import { useLang } from "@/i18n/LanguageContext";
import { pulseRepository } from "@/repositories/PulseRepository";
import { useCallback, useState } from "react";

/**
 * Dashboard tile that opens the backend's Laravel Pulse monitoring dashboard
 * (server load & disk usage, slow queries, exceptions, per-user request
 * volumes) in the operating system's browser.
 *
 * ## Why the external browser and not an in-app view
 * Pulse is a server-rendered page authenticated by a session COOKIE, while
 * this panel authenticates with a Sanctum bearer token — an in-app `fetch`
 * could never render it. Embedding it in an iframe/webview is impossible too:
 * the backend sends `X-Frame-Options: DENY` on staging and production. Handing
 * the URL to the real browser is therefore the only correct target, and it is
 * also the one that gets a proper session cookie jar.
 *
 * Electron's `setWindowOpenHandler` (electron/main.ts) already converts a
 * `window.open` into `shell.openExternal` and denies the in-app window, so no
 * new preload bridge is needed — this reuses the path external links already
 * take.
 *
 * Rendering is the caller's decision (Home only mounts it for admins); the
 * backend independently rejects everyone else with a 403, so the UI gate is
 * convenience, never the security boundary.
 */
const PulseDashboardCard = () => {
  const { t } = useLang();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    // Guard against a double click minting (and burning) two one-time links.
    if (opening) return;

    setOpening(true);
    setError(null);
    try {
      const link = await pulseRepository.issueAccessLink();
      // Single-use and short-lived: opened immediately, never stored in state
      // or in the router, so it cannot be re-opened after it has been spent.
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch {
      // Deliberately generic: the failure is either "not an admin" or a
      // network problem, and neither benefits from echoing a server message
      // into the UI.
      setError(t("home.menu.pulseError"));
    } finally {
      setOpening(false);
    }
  }, [opening, t]);

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={opening}
      className="card"
      style={{
        minWidth: 220,
        textAlign: "left",
        cursor: opening ? "progress" : "pointer",
        font: "inherit",
        color: "inherit",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        {t("home.menu.pulse")}
      </div>
      <div className="muted">
        {error ?? (opening ? t("home.menu.pulseOpening") : t("home.menu.pulseSub"))}
      </div>
    </button>
  );
};

export default PulseDashboardCard;
