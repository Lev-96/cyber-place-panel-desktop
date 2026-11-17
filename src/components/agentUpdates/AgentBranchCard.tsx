import { apiAgentUpdateApply, type AgentApprovedRelease, type AgentBranchRollout, type AgentBranchStatus } from "@/api/agent-updates";
import { blockingKeyOf } from "@/api/blockingErrors";
import Button from "@/components/ui/Button";
import { classifyError, serverDetailOf } from "@/components/ui/state";
import { useLang } from "@/i18n/LanguageContext";
import { renderText, textKey, type LocalizedText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { useState } from "react";

/** A branch the Agent concerns: the server sent its computers' figures. */
export type AgentRelevantBranch = AgentBranchStatus & { agent: AgentBranchRollout };

interface Props {
  branch: AgentRelevantBranch;
  approved: AgentApprovedRelease | null;
  /**
   * After the server accepted the apply: re-read this screen AND the shared
   * updates context, so the side menu's badge clears at once.
   */
  onApplied: () => void;
}

/**
 * Why an apply failed, in the panel's words where it has them: a blocked
 * branch by its block code, no connection as such, otherwise the server's own
 * sentence (a refusal with no code of ours), and only then a generic line.
 * Kept as `LocalizedText` so it follows a language switch.
 */
const applyFailure = (error: unknown): LocalizedText => {
  const blocked = blockingKeyOf(error);
  if (blocked) return textKey(blocked);
  if (classifyError(error) === "offline") return textKey("state.offline.description");
  return serverDetailOf(error) ?? textKey("agentUpdates.applyFailed");
};

/**
 * One branch on «Обновления агента» (2026-11-17): its address, the approved
 * version, how many of its connected computers are still to get it — every
 * figure as the server counted it — and «Применить в этом филиале» while the
 * server says the branch is pending.
 */
const AgentBranchCard = ({ branch, approved, onApplied }: Props) => {
  const { t } = useLang();
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: LocalizedText } | null>(null);
  const rollout = branch.agent;

  const apply = async () => {
    setApplying(true);
    setNotice(null);
    try {
      await apiAgentUpdateApply(branch.branch_id);
      setNotice({ ok: true, text: textKey("agentUpdates.applied") });
      onApplied();
    } catch (error) {
      setNotice({ ok: false, text: applyFailure(error) });
    } finally {
      setApplying(false);
    }
  };

  return (
    <article className="agent-branch-card" data-testid={`agent-branch-${branch.branch_id}`}>
      <h3 className="agent-branch-card__address">{branch.address}</h3>
      {approved && (
        <>
          <div className="agent-branch-card__version">
            <span className="muted">{t("agentUpdates.approvedVersion")}</span>
            <strong>{approved.version}</strong>
          </div>
          {rollout.pending_pc_count > 0 ? (
            <p className="agent-branch-card__progress">
              {fmt(t("agentUpdates.branch.pending"), rollout.pending_pc_count, rollout.pc_count)}
            </p>
          ) : (
            <p className="agent-branch-card__progress agent-branch-card__progress--done">
              {t("agentUpdates.branch.allReceived")}
            </p>
          )}
          {rollout.pending && (
            <div className="agent-branch-card__actions">
              <Button type="button" onClick={() => void apply()} disabled={applying}>
                {applying ? t("agentUpdates.promoting") : t("agentUpdates.branch.applyBtn")}
              </Button>
            </div>
          )}
        </>
      )}
      {notice && (
        <p
          className={`agent-branch-card__note agent-branch-card__note--${notice.ok ? "ok" : "error"}`}
          role={notice.ok ? "status" : "alert"}
        >
          {renderText(notice.text, t)}
        </p>
      )}
    </article>
  );
};

export default AgentBranchCard;
