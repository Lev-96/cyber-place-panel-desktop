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
                // "Current version" semantics:
                //   - Panel row → the version of THIS install (the
                //     same number "Эта установка" used to show on its
                //     own card). That's the truth the admin cares about.
                //   - Agent row → fall back to the promoted pointer
                //     since we don't run an agent here.
                const current =
                  app === "panel"
                    ? local?.currentVersion ?? entry?.current?.version ?? "—"
                    : entry?.current?.version ?? "—";
                const available = entry?.available?.version ?? (entry?.error ? "?" : "—");

                // Status: default green. For the Panel row the local
                // updater state takes precedence (so the admin sees
                // "Downloading 42%" / "Ready to install" inline,
                // no separate card); for the Agent row we use the
                // pointer-vs-GitHub comparison the backend computed.
                let tone: "ok" | "warn" | "bad" = "ok";
                let statusLabel = t("updates.statusUpToDate");

                if (entry?.error) {
                  tone = "bad"; statusLabel = t("updates.statusError");
                } else if (app === "panel" && local) {
                  // Local updater is authoritative for the Panel row.
                  switch (local.status) {
                    case "downloading":
                      tone = "warn";
                      statusLabel = fmt(t("updates.localDownloading"), local.progressPercent ?? 0);
                      break;
                    case "downloaded":
                      tone = "warn";
                      statusLabel = fmt(t("updates.localDownloaded"), local.availableVersion ?? "?");
                      break;
                    case "error":
                      tone = "bad";
                      statusLabel = fmt(t("updates.localError"), local.error ?? "unknown");
                      break;
                    default:
                      // checking / available / not-available / idle
                      if (entry?.has_update && local.currentVersion !== entry.available?.version) {
                        tone = "warn"; statusLabel = t("updates.statusUpdateAvailable");
                      }
                  }
                } else if (entry?.has_update) {
                  tone = "warn"; statusLabel = t("updates.statusUpdateAvailable");
                }

                const showInstallBtn = app === "panel" && local?.status === "downloaded";

                return (
                  <tr key={app} style={{ borderTop: "1px solid #1f2a44" }}>
                    <td style={{ padding: "10px 6px", fontWeight: 600 }}>
                      {t(APP_LABEL_KEY[app])}
                    </td>
                    <td style={{ padding: "10px 6px" }}>{current}</td>
                    <td style={{ padding: "10px 6px" }}>{available}</td>
                    <td style={{ padding: "10px 6px" }}>
                      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <StatusPill label={statusLabel} tone={tone} />
                        {showInstallBtn && (
                          <Button
                            type="button"
                            onClick={() => { void window.cyberplaceUpdates?.install(); }}
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            {t("updates.installNow")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

    </ScreenWithBg>
  );
};

export default AppUpdates;
