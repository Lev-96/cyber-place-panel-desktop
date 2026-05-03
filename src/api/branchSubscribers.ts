import { request } from "./client";

export interface IBranchSubscriber {
  id: number;
  branch_id: number;
  guest_id: number;
  guest?: {
    id: number;
    name: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  created_at?: string;
}

/**
 * Staff-facing list of every guest subscribed to a branch's
 * announcements. Auth: sanctum-only — backend gates this endpoint
 * via BranchController's constructor middleware.
 */
export const apiListBranchSubscribers = (branchId: number) =>
  request<{ data: IBranchSubscriber[] }>(`/branches/${branchId}/subscribers`);
