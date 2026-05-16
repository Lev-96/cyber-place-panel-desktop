import { request } from "./client";
import type { UpdateCheckEntry } from "./updates";

/**
 * Owner / manager-facing agent rollout. Server side at
 * cyber-place/app/Http/Controllers/Owner/Updates/AgentUpdateController.
 *
 * Returns the same `UpdateCheckEntry` shape the admin updates page
 * uses for its agent row, so the renderer can share types.
 *
 *  /agent-updates/status    — current promoted agent + latest GitHub
 *  /agent-updates/promote   — flip the agent pointer + broadcast
 */

export const apiAgentUpdateStatus = async (): Promise<UpdateCheckEntry> => {
  const res = await request<{ data: UpdateCheckEntry }>("/agent-updates/status");
  return res.data;
};

export const apiAgentUpdatePromote = async (): Promise<UpdateCheckEntry> => {
  const res = await request<{ data: UpdateCheckEntry }>("/agent-updates/promote", {
    method: "POST",
  });
  return res.data;
};
