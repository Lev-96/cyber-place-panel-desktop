import { apiAgentUpdateStatus } from "@/api/agent-updates";
import AgentBranchCard, { type AgentRelevantBranch } from "@/components/agentUpdates/AgentBranchCard";
import DesktopUpdateCard from "@/components/updates/DesktopUpdateCard";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { useAppUpdates } from "@/realtime/useAppUpdates";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { useEffect, useRef } from "react";

/**
 * Owner / manager-only screen — STAGE TWO of the two-stage agent rollout.
 * An admin first APPROVES a version; here the partner APPLIES that approved
 * version, branch by branch (2026-11-17), on their own timing. There is no
 * "promote to GitHub latest" here — a partner can only roll out what an admin
 * has already approved.
 *
 * One card per branch the server marks `agent_relevant` (a computer there ran
 * the Agent recently). A branch with consoles only, or with a computer that
 * never connected, says nothing about the Agent; with no such branch at all
 * the screen shows its empty state and no Agent block.
 *
 * Three sources of freshness, in order of immediacy:
 *   1. Reverb `.app-update.promoted` (app:agent) — fires the instant an
 *      admin approves a new agent version.
 *   2. 60-second polling of `/agent-updates/status`.
 *   3. Initial fetch on mount — no manual "Check" button.
 * After an apply both this screen and the shared updates context read again,
 * so the side menu's badge clears with the card instead of a minute later.
 */

const POLL_INTERVAL_MS = 60_000;

const AgentUpdates = () => {
  const { t } = useLang();
  const { reload: reloadUpdatesBadge } = useUpdatesNotification();
  const { data, loading, error, reload } = useAsync(() => apiAgentUpdateStatus(), []);

  // Armed once, through a ref (realtime rule 11): `useAsync` hands out a new
  // object every render, and an interval keyed on it is never reached.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    const id = setInterval(() => { void reloadRef.current(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Reverb push for instant refresh when an admin approves. We pass
  // "panel" as thisApp because this binary IS the panel — the hook's
  // gated updater should only fire for panel events. Our callback
  // receives both and re-fetches only on agent broadcasts.
  useAppUpdates("panel", (event) => {
    if (event.app === "agent") void reloadRef.current();
  });

  // The server's own flag decides which branches get a card; nothing is
  // counted or compared here. A backend older than this screen sends no
  // `branches`: that reads as "no branch to show", never as a crash.
  const branches = data
    ? (data.branches ?? []).filter((b): b is AgentRelevantBranch => b.agent_relevant && b.agent !== null)
    : null;
  const view = deriveViewState({ loading, error, data: branches });

  const afterApply = () => {
    void reloadRef.current();
    void reloadUpdatesBadge();
  };

  // The Agent block only where a branch has a computer that runs it
  // (2026-11-17, owner): no such branch — nothing about the Agent at all.
  const agentShown = view.kind !== "empty";

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("ownUpdates.title")}>
      {/* The desktop itself, for every role (2026-11-17): version, «Проверить
          обновления», «Установить и перезапустить». */}
      <div className="gradient-card">
        <div className="gradient-card-inner">
          <DesktopUpdateCard />
        </div>
      </div>
      {agentShown && (
      <div className="gradient-card" data-testid="agent-updates-block">
        <div className="gradient-card-inner">
          <strong className="desktop-update__title">{t("agentUpdates.title")}</strong>
          <p className="muted agent-updates__subtitle">{t("agentUpdates.subtitle")}</p>
          <StateSwitch
            view={view}
            size="section"
            skeleton={<ListSkeleton rows={2} />}
            onRetry={() => void reload()}
            error={{ titleKey: "agentUpdates.state.errorTitle" }}
            empty={{ titleKey: "agentUpdates.state.emptyTitle", descriptionKey: "agentUpdates.state.emptyDescription" }}
          >
            {!data?.approved && <p className="muted agent-updates__note">{t("agentUpdates.notApprovedYet")}</p>}
            <div className="agent-branches">
              {(branches ?? []).map((branch) => (
                <AgentBranchCard
                  key={branch.branch_id}
                  branch={branch}
                  approved={data?.approved ?? null}
                  onApplied={afterApply}
                />
              ))}
            </div>
          </StateSwitch>
        </div>
      </div>
      )}
    </ScreenWithBg>
  );
};

export default AgentUpdates;
