import { request } from "./client";
import type { UpdateCheckEntry } from "./updates";

/**
 * Owner / manager-facing agent rollout — STAGE TWO of the two-stage flow.
 * Server side at
 * cyber-place/app/Http/Controllers/Owner/Updates/AgentUpdateController.
 *
 * An admin first APPROVES a version (stage one). Only then can an owner /
 * manager APPLY that approved version to the computers of their OWN branches.
 *
 *  /agent-updates/status    — the approved version and, per branch, how many
 *                             connected computers still have to get it
 *  /agent-updates/promote   — apply the approved version to one branch
 *
 * Every figure here is the SERVER's (2026-11-17): which branch has a connected
 * computer, how many are left, whether a branch is pending and how many are.
 * The panel prints them and never works them out itself.
 */

export interface AgentApprovedRelease {
  version: string;
  github_tag: string | null;
  mandatory: boolean;
}

/** One branch's computers and the approved version, as the server counts them. */
export interface AgentBranchRollout {
  /** Computers whose Agent connected within the server's window. */
  pc_count: number;
  /** Of those, how many have not been sent the approved version. */
  pending_pc_count: number;
  /** Something to apply here: approved, a computer left, the branch open. */
  pending: boolean;
}

export interface AgentBranchStatus {
  branch_id: number;
  address: string;
  /** The branch has a computer whose Agent connected recently. */
  agent_relevant: boolean;
  /** Null when the branch has no such computer: nothing about the Agent there. */
  agent: AgentBranchRollout | null;
}

export interface AgentUpdateStatus extends UpdateCheckEntry {
  /** The version an admin has approved for rollout, or null if none yet. */
  approved: AgentApprovedRelease | null;
  /**
   * Kept for panels 1.0.62/1.0.63, which read these two; this build does not.
   * `venue_pc_count`: connected computers in scope. `applied_version`: the
   * approved version once nothing is pending, null while something is.
   */
  venue_pc_count: number;
  applied_version: string | null;
  /** Every branch in the caller's scope, in id order. */
  branches: AgentBranchStatus[];
  /** How many branches are pending: the side menu's badge, as sent. */
  pending_branch_count: number;
}

export interface AgentApplyResult {
  data: UpdateCheckEntry | null;
  applied_pc_count: number;
  version: string;
  /** The branches whose computers were sent the version. */
  applied_branch_ids: number[];
}

export const apiAgentUpdateStatus = async (): Promise<AgentUpdateStatus> => {
  const res = await request<{ data: AgentUpdateStatus }>("/agent-updates/status");
  return res.data;
};

/**
 * Apply the admin-approved agent version to ONE branch's computers. The
 * backend answers 409 (ApiError.status === 409) while nothing is approved, and
 * 403 for a branch outside the caller's scope or one an administrator blocked
 * (that one with the block's `code`). This build never sends the request
 * without a branch: that form is kept for panels 1.0.62/1.0.63.
 */
export const apiAgentUpdateApply = async (branchId: number): Promise<AgentApplyResult> =>
  request<AgentApplyResult>("/agent-updates/promote", { method: "POST", body: { branch_id: branchId } });
