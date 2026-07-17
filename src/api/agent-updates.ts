import { request } from "./client";
import type { UpdateCheckEntry } from "./updates";

/**
 * Owner / manager-facing agent rollout — STAGE TWO of the two-stage flow.
 * Server side at
 * cyber-place/app/Http/Controllers/Owner/Updates/AgentUpdateController.
 *
 * An admin first APPROVES a version (stage one). Only then can an owner /
 * manager APPLY that approved version to the Pcs of their OWN venue.
 *
 *  /agent-updates/status    — agent state + the admin-approved version
 *  /agent-updates/promote   — apply the approved version to my venue
 */

export interface AgentApprovedRelease {
  version: string;
  github_tag: string | null;
  mandatory: boolean;
}

export interface AgentUpdateStatus extends UpdateCheckEntry {
  /** The version an admin has approved for rollout, or null if none yet. */
  approved: AgentApprovedRelease | null;
  /** How many of the caller's own Pcs an apply would target. */
  venue_pc_count: number;
}

export interface AgentApplyResult {
  data: UpdateCheckEntry | null;
  applied_pc_count: number;
  version: string;
}

export const apiAgentUpdateStatus = async (): Promise<AgentUpdateStatus> => {
  const res = await request<{ data: AgentUpdateStatus }>("/agent-updates/status");
  return res.data;
};

/**
 * Apply the admin-approved agent version to the caller's own venue. The
 * backend replies 409 (ApiError.status === 409) when nothing has been
 * approved yet — callers should surface that as "waiting for admin
 * approval", not a hard failure.
 */
export const apiAgentUpdateApply = async (): Promise<AgentApplyResult> => {
  return request<AgentApplyResult>("/agent-updates/promote", { method: "POST" });
};
