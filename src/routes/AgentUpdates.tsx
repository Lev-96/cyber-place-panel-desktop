import { apiAgentUpdatePromote, apiAgentUpdateStatus } from "@/api/agent-updates";
import type { UpdateCheckEntry } from "@/api/updates";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { useAppUpdates } from "@/realtime/useAppUpdates";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owner / manager-only screen that drives the kiosk-agent rollout
 * for the partner's own fleet. Twin of the admin AppUpdates screen
 * but scoped to a single app and stripped of admin-only knobs
 * (mandatory flag, panel app).
 *
 * Three sources of freshness, in order of immediacy:
 *   1. Reverb `.app-update.promoted` broadcast filtered to `app:agent`
 *      — fires the instant any party (admin or another owner) promotes.
 *   2. 60-second polling of `/agent-updates/status` — covers the
 *      "new GitHub release exists but no one has promoted yet" gap
 *      since the backend's GithubReleasesClient itself caches 60s.
 *   3. Initial fetch on mount — no manual "Check" button.
 */

type ApiState = "loading" | "ready" | "error";

const POLL_INTERVAL_MS = 60_000;

const AgentUpdates = () => {
  const { t } = useLang();
  const [data, setData] = useState<UpdateCheckEntry | null>(null);
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiError, setApiError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  // Stable reload fn so the polling effect doesn't reset on every
  // render. We deliberately do NOT flip apiState to "loading" inside
  // the periodic refresh — only the initial mount shows the spinner.
  const reload = useCallback(async (initial: boolean) => {
    if (initial) setApiState("loading");
    setApiError(null);
    try {
      const next = await apiAgentUpdateStatus();
      setData(next);
      setApiState("ready");
    } catch (e) {
      setApiState("error");
      setApiError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    void reloadRef.current(true);
    const id = setInterval(() => { void reloadRef.current(false); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Reverb push for instant refresh when admin (or any owner) promotes.
  // We pass "panel" as thisApp because this binary IS the panel — the
  // hook's auto-`check()` should only fire for panel events. Our
  // callback receives both and re-fetches only on agent broadcasts.
  useAppUpdates("panel", (event) => {
    if (event.app === "agent") void reloadRef.current(false);
  });

  const runPromote = async () => {
    setPromoting(true);
    setApiError(null);
    try {
      const next = await apiAgentUpdatePromote();
      setData(next);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : t("agentUpdates.cannotPromote"));
    } finally {
      setPromoting(false);
    }
  };

  const current = data?.current?.version ?? "—";
  const available = data?.available?.version ?? (data?.error ? "?" : "—");
  const hasUpdate = !!data?.has_update;

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("agentUpdates.title")}>
      <div className="gradient-card">
        <div className="gradient-card-inner">
          <p className="muted" style={{ margin: "0 0 12px" }}>
            {t("agentUpdates.subtitle")}
          </p>

          {apiState === "loading" && (
            <p className="muted">{t("agentUpdates.loading")}</p>
          )}

          {apiState === "error" && apiError && (
            <p style={{ color: "#ef4444" }}>{apiError}</p>
          )}

          {apiState === "ready" && (
            <div className="col" style={{ gap: 16 }}>
              <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("agentUpdates.currentVersion")}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{current}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("agentUpdates.latestVersion")}
                  </div>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: hasUpdate ? "#07ddf1" : undefined,
                  }}>
                    {available}
                  </div>
                </div>
              </div>

              {data?.error && (
                <p className="muted" style={{ color: "#ef4444", margin: 0 }}>
                  {data.error}
                </p>
              )}

              {hasUpdate ? (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    {t("agentUpdates.hasUpdate")}
                  </p>
                  <div>
                    <Button
                      type="button"
                      onClick={runPromote}
                      disabled={promoting}
                    >
                      {promoting
                        ? t("agentUpdates.promoting")
                        : t("agentUpdates.promoteBtn")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {t("agentUpdates.upToDate")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </ScreenWithBg>
  );
};

export default AgentUpdates;
