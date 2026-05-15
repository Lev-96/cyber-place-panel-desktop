import { apiCheckUpdates, apiPromoteUpdates, type AppKind, type UpdateCheckResponse } from "@/api/updates";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useAppUpdates } from "@/realtime/useAppUpdates";
import type { DesktopUpdateState } from "@/types/desktopUpdates";
import { useEffect, useMemo, useState } from "react";

/**
 * Admin-only screen that drives the desktop auto-update flow. Lives
 * under `/settings/updates`, gated by `menu.updates` permission.
 *
 * Two responsibilities:
 *   1. Server-side overview — for each app, show "current promoted
 *      version" vs "latest on GitHub" and let the admin promote both
 *      with one click. Powered by `/admin/updates/check` + `/admin/updates/promote`.
 *   2. Local-machine status — show how THIS panel installation is
 *      progressing through its own update download. Powered by the
 *      `window.cyberplaceUpdates` IPC bridge to the main-process
 *      `UpdateService`.
 *
 * Stateful but flat — no nested context, no router-level state. A
 * future tournament-style "list of past releases" screen can branch
 * from here without restructuring the component.
 */

type ApiState = "idle" | "loading" | "ready" | "error";

const StatusPill = ({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "info" }) => {
  const palette: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    ok:   { bg: "rgba(34, 197, 94, 0.14)",  fg: "#22c55e", border: "rgba(34, 197, 94, 0.45)" },
    warn: { bg: "rgba(7, 221, 241, 0.14)",  fg: "#07ddf1", border: "rgba(7, 221, 241, 0.45)" },
    bad:  { bg: "rgba(239, 68, 68, 0.14)",  fg: "#ef4444", border: "rgba(239, 68, 68, 0.45)" },
    info: { bg: "rgba(148, 163, 184, 0.14)", fg: "#94a3b8", border: "rgba(148, 163, 184, 0.4)" },
  };
  const s = palette[tone];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      background: s.bg,
      color: s.fg,
      border: `1px solid ${s.border}`,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {label}
    </span>
  );
};

const APPS: AppKind[] = ["panel", "agent"];
const APP_LABEL_KEY: Record<AppKind, string> = {
  panel: "updates.appPanel",
  agent: "updates.appAgent",
};

const AppUpdates = () => {
  const { t } = useLang();

  // Backend-side: catalogue + latest GitHub release per app.
  const [data, setData] = useState<UpdateCheckResponse | null>(null);
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  // Client-side: status of THIS panel's own electron-updater.
  const [local, setLocal] = useState<DesktopUpdateState | null>(null);
  const hasBridge = typeof window !== "undefined" && typeof window.cyberplaceUpdates !== "undefined";

  // Reverb push: when ANY admin (this one or another) promotes a
  // release, the broadcast lands here and we re-fetch the snapshot so
  // both buttons reflect the new state without a manual click.
  useAppUpdates("panel", () => { void runCheck(); });

  useEffect(() => {
    if (!hasBridge) return;
    let mounted = true;

    // Seed + subscribe to live state from the main process.
    window.cyberplaceUpdates?.getState().then((s) => {
      if (mounted && s) setLocal(s);
    }).catch(() => { /* ignored — bridge already gone */ });

    const unsub = window.cyberplaceUpdates?.onState((s) => {
      if (mounted) setLocal(s as DesktopUpdateState);
    });

    return () => { mounted = false; unsub?.(); };
  }, [hasBridge]);

  const runCheck = async () => {
    setApiState("loading");
    setApiError(null);
    try {
      const next = await apiCheckUpdates();
      setData(next);
      setApiState("ready");
    } catch (e) {
      setApiState("error");
      setApiError(e instanceof Error ? e.message : String(e));
    }
  };

  const runPromote = async () => {
    setPromoting(true);
    setApiError(null);
    try {
      const next = await apiPromoteUpdates();
      setData(next);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : t("updates.cannotPromote"));
    } finally {
      setPromoting(false);
    }
  };

  const anyUpdates = useMemo(() => {
    if (!data) return false;
    return APPS.some((a) => data[a]?.has_update);
  }, [data]);

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("updates.title")}>
      <div className="gradient-card">
        <div className="gradient-card-inner">
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Button type="button" onClick={runCheck} disabled={apiState === "loading"}>
              {apiState === "loading" ? t("updates.checking") : t("updates.checkBtn")}
            </Button>
            {/* The "Apply" button only materializes after the admin has
                clicked Check AND at least one app has a newer release on
                GitHub. Showing it earlier (greyed-out) felt like a dead
                button — easier to hide outright so the screen has one
                clear call-to-action at a time. */}
            {apiState === "ready" && anyUpdates && (
              <Button
                type="button"
                onClick={runPromote}
                disabled={promoting}
              >
                {promoting ? t("updates.promoting") : t("updates.promoteBtn")}
              </Button>
            )}
          </div>

          {apiError && (
            <p className="muted" style={{ color: "#ef4444", marginTop: 8 }}>
              {apiError}
            </p>
          )}

          {apiState === "ready" && data && (
            <p className="muted" style={{ marginTop: 6 }}>
              {anyUpdates ? t("updates.hasUpdates") : t("updates.noUpdates")}
            </p>
          )}
        </div>
      </div>

      {/* Snapshot table only after the admin has actively asked. Keeps
          the initial screen down to a single, clear call-to-action
          ("Check"); the table fills in after the round-trip. */}
      {data && (
      <div className="gradient-card" style={{ marginTop: 12 }}>
        <div className="gradient-card-inner">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 12 }}>
                <th style={{ padding: "8px 6px" }}>App</th>
                <th style={{ padding: "8px 6px" }}>{t("updates.colCurrent")}</th>
                <th style={{ padding: "8px 6px" }}>{t("updates.colAvailable")}</th>
                <th style={{ padding: "8px 6px" }}>{t("updates.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {APPS.map((app) => {
                const entry = data?.[app];
                // "Current version" means "what's running on the floor
                // right now". Until the backend pointer is set (no
                // promote yet), the truthful answer is "whatever was
                // last installed". For THIS app we know it directly
                // from the local bridge; for the other app we have to
                // fall back to the dash.
                const localFallback = app === "panel" ? local?.currentVersion : null;
                const current =
                  entry?.current?.version ??
                  localFallback ??
                  "—";
                const available = entry?.available?.version ?? (entry?.error ? "?" : "—");
                // Default tone: green/"up to date". The previous "not
                // promoted yet" branch read as an error state to
                // admins even though it's a perfectly normal initial
                // condition — nothing has been rolled out because
                // there's nothing newer than what's already installed.
                let tone: "ok" | "warn" | "bad" = "ok";
                let statusLabel = t("updates.statusUpToDate");
                if (entry?.error) { tone = "bad"; statusLabel = t("updates.statusError"); }
                else if (entry?.has_update) { tone = "warn"; statusLabel = t("updates.statusUpdateAvailable"); }

                return (
                  <tr key={app} style={{ borderTop: "1px solid #1f2a44" }}>
                    <td style={{ padding: "10px 6px", fontWeight: 600 }}>
                      {t(APP_LABEL_KEY[app])}
                    </td>
                    <td style={{ padding: "10px 6px" }}>{current}</td>
                    <td style={{ padding: "10px 6px" }}>{available}</td>
                    <td style={{ padding: "10px 6px" }}>
                      <StatusPill label={statusLabel} tone={tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div className="gradient-card" style={{ marginTop: 12 }}>
        <div className="gradient-card-inner">
          <h3 style={{ margin: "0 0 8px" }}>{t("updates.localTitle")}</h3>
          <LocalUpdateBlock state={local} bridgePresent={hasBridge} />
        </div>
      </div>
    </ScreenWithBg>
  );
};

const LocalUpdateBlock = ({
  state,
  bridgePresent,
}: {
  state: DesktopUpdateState | null;
  bridgePresent: boolean;
}) => {
  const { t } = useLang();

  if (!bridgePresent) {
    return <p className="muted">Running outside the desktop bundle — no local update bridge.</p>;
  }

  if (!state) {
    // Bridge present but state hasn't arrived yet. Render nothing —
    // a "loading" placeholder here would only flash for a few ms.
    return null;
  }

  const currentRow = (
    <p className="muted" style={{ marginTop: 0 }}>
      v{state.currentVersion}
    </p>
  );

  // Only render an extra status line when the updater is actually
  // doing something. Idle ("nothing happening, you're on the latest
  // installed build") deserves silence — the version above is enough.
  let message: string | null = null;
  switch (state.status) {
    case "checking":
      message = t("updates.localChecking");
      break;
    case "available":
      message = fmt(t("updates.localAvailable"), state.availableVersion ?? "?");
      break;
    case "downloading":
      message = fmt(t("updates.localDownloading"), state.progressPercent ?? 0);
      break;
    case "downloaded":
      message = fmt(t("updates.localDownloaded"), state.availableVersion ?? "?");
      break;
    case "error":
      message = fmt(t("updates.localError"), state.error ?? "unknown");
      break;
    case "idle":
    case "not-available":
    default:
      message = null;
  }

  return (
    <>
      {currentRow}
      {message !== null && (
        <p style={{ margin: "6px 0 10px", color: state.status === "error" ? "#ef4444" : undefined }}>
          {message}
        </p>
      )}
      {state.status === "downloaded" && (
        <Button type="button" onClick={() => { void window.cyberplaceUpdates?.install(); }}>
          {t("updates.installNow")}
        </Button>
      )}
    </>
  );
};

export default AppUpdates;
