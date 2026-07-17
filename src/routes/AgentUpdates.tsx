import { apiAgentUpdateApply, apiAgentUpdateStatus, type AgentUpdateStatus } from "@/api/agent-updates";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { useAppUpdates } from "@/realtime/useAppUpdates";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owner / manager-only screen — STAGE TWO of the two-stage agent rollout.
 * An admin first APPROVES a version; here the partner APPLIES that
 * approved version to the kiosk agents of their OWN branches, on their
 * own timing. There is no "promote to GitHub latest" here — a partner
 * can only roll out what an admin has already approved.
 *
 * Three sources of freshness, in order of immediacy:
 *   1. Reverb `.app-update.promoted` (app:agent) — fires the instant an
 *      admin approves a new agent version.
 *   2. 60-second polling of `/agent-updates/status`.
 *   3. Initial fetch on mount — no manual "Check" button.
 */

type ApiState = "loading" | "ready" | "error";

const POLL_INTERVAL_MS = 60_000;

const AgentUpdates = () => {
  const { t } = useLang();
  const [data, setData] = useState<AgentUpdateStatus | null>(null);
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiError, setApiError] = useState<string | null>(null);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Stable reload fn so the polling effect doesn't reset on every render.
  // The periodic refresh never flips apiState to "loading" — only the
  // initial mount shows the spinner.
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

  // Reverb push for instant refresh when an admin approves. We pass
  // "panel" as thisApp because this binary IS the panel — the hook's
  // gated updater should only fire for panel events. Our callback
  // receives both and re-fetches only on agent broadcasts.
  useAppUpdates("panel", (event) => {
    if (event.app === "agent") void reloadRef.current(false);
  });

  const runApply = async () => {
    setApplying(true);
    setApiError(null);
    setAppliedMsg(null);
    try {
      await apiAgentUpdateApply();
      setAppliedMsg(t("agentUpdates.applied"));
      void reloadRef.current(false);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : t("agentUpdates.cannotPromote"));
    } finally {
      setApplying(false);
    }
  };

  const current = data?.current?.version ?? "—";
  const approved = data?.approved ?? null;
  const venuePcCount = data?.venue_pc_count ?? 0;

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
                    {t("agentUpdates.approvedVersion")}
                  </div>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: approved ? "#07ddf1" : undefined,
                  }}>
                    {approved?.version ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("agentUpdates.venuePcs")}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{venuePcCount}</div>
                </div>
              </div>

              {data?.error && (
                <p className="muted" style={{ color: "#ef4444", margin: 0 }}>
                  {data.error}
                </p>
              )}
              {apiError && (
                <p style={{ color: "#ef4444", margin: 0 }}>{apiError}</p>
              )}
              {appliedMsg && (
                <p style={{ color: "#22c55e", margin: 0 }}>{appliedMsg}</p>
              )}

              {approved ? (
                venuePcCount > 0 ? (
                  <div>
                    <Button type="button" onClick={runApply} disabled={applying}>
                      {applying
                        ? t("agentUpdates.promoting")
                        : t("agentUpdates.applyBtn")}
                    </Button>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    {t("agentUpdates.noVenuePcs")}
                  </p>
                )
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {t("agentUpdates.notApprovedYet")}
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
