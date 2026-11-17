import type { AgentUpdateStatus } from "@/api/agent-updates";
import type { UpdateCheckEntry } from "@/api/updates";

/**
 * The side menu's update badges — ONE answer, read by the desktop Sidebar and
 * by the owner web's bottom bar (`src/web/appShell/sideMenu.ts` there), so the
 * two can never count differently.
 *
 * Kept out of `UpdatesNotificationContext` on purpose: it is a pure function of
 * the context's state, and a module of its own is what a test that stubs the
 * context still runs for real.
 */
export interface UpdateBadgeCounts {
  /** Admin's «App updates»: one per app with a release waiting to be promoted. */
  updates: number;
  /** Owner's / manager's «Agent updates»: the branches the SERVER says are pending. */
  agentUpdates: number;
}

export interface UpdateBadgeSource {
  panel: UpdateCheckEntry | null;
  agent: UpdateCheckEntry | null;
  /** Absent in a context that predates the per-branch rollout (a test stub). */
  agentRollout?: AgentUpdateStatus | null;
}

/**
 * `agentUpdates` is `pending_branch_count` exactly as sent (2026-11-17). It is
 * never recounted from `branches[]` or `has_update` here: which branch is
 * pending depends on rules the server owns (which computers count as
 * connected, which were already sent the version, which branch is blocked).
 */
export const updateBadgeCounts = ({ panel, agent, agentRollout }: UpdateBadgeSource): UpdateBadgeCounts => ({
  updates: (panel?.has_update ? 1 : 0) + (agent?.has_update ? 1 : 0),
  agentUpdates: agentRollout?.pending_branch_count ?? 0,
});
