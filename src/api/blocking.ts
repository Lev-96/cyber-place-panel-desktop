import { request } from "./client";

/**
 * Administrative blocking of a company or a branch.
 *
 * One module for both, because they ARE one feature at two scopes: same verbs,
 * same response shape, same admin-only rule. A screen that blocks a branch
 * therefore reads exactly like one that blocks a company, and a third scope
 * added later needs one line here rather than a second parallel client.
 *
 * The block is modelled as a resource rather than an action: POST creates it,
 * DELETE removes it. Both are idempotent server-side, so a double-click cannot
 * produce a second block or a half-applied one.
 */

/** What can be blocked. Mirrors the backend's `BlockStateResource.type`. */
export type BlockableKind = "company" | "branch";

export interface IBlockState {
  type: BlockableKind;
  id: number;
  name: string;
  /**
   * The entity's OWN block. For a branch this is what the toggle owns — a
   * branch closed only because its company is blocked has `blocked_at: null`
   * and `is_blocked: true`.
   */
  blocked_at: string | null;
  /** Whether it is closed at all, inherited blocks included. */
  is_blocked: boolean;
  /** False when the entity was already in the requested state — a no-op, not an error. */
  changed: boolean;
  /** How many branches this block covers. */
  affected_branches: number;
  /** Staff accounts locked out by it (owner + managers). */
  affected_users: number;
  /** Sessions actually signed out — always 0 for an unblock. */
  revoked_sessions: number;
}

interface BlockResponse {
  data: IBlockState;
  message?: string;
}

/**
 * Both endpoints live under `/admin/*`, which is the authorisation boundary
 * itself: the backend refuses anyone but an admin, so a non-admin panel build
 * cannot lift a block by calling the API directly.
 */
const blockPath = (kind: BlockableKind, id: number): string =>
  kind === "company" ? `/admin/companies/${id}/block` : `/admin/branches/${id}/block`;

export const apiBlock = (kind: BlockableKind, id: number) =>
  request<BlockResponse>(blockPath(kind, id), { method: "POST" });

export const apiUnblock = (kind: BlockableKind, id: number) =>
  request<BlockResponse>(blockPath(kind, id), { method: "DELETE" });
