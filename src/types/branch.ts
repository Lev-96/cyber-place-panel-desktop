/**
 * Domain vocabulary for a branch's status — the client-side mirror of the
 * backend `branches.status` enum (`App\Enums\BranchStatus`: `active` |
 * `inactive`).
 *
 * `status` answers one question: may players see this branch? An `inactive`
 * branch is hidden from the player app (catalogue, tournaments, new bookings,
 * subscriptions) and stays fully workable for its staff. It is the OWNER's
 * switch (and the admin's) — chosen on create, flipped on edit.
 *
 * It is NOT the administrative block (`blocked_at` / `is_blocked`, a separate
 * column on purpose): the block is imposed on a company by an admin and its
 * owner cannot lift it. The player app lists only branches that are `active`
 * AND not blocked.
 */
export type BranchStatus = "active" | "inactive";

export const BRANCH_STATUS = {
  Active: "active",
  Inactive: "inactive",
} as const satisfies Record<string, BranchStatus>;

/** The two states in the order the toggle offers them. */
export const BRANCH_STATUSES: readonly BranchStatus[] = [BRANCH_STATUS.Active, BRANCH_STATUS.Inactive];

/** What a new branch starts as unless somebody chose otherwise — the backend default too. */
export const DEFAULT_BRANCH_STATUS: BranchStatus = BRANCH_STATUS.Active;

/**
 * Is this branch switched off for players?
 *
 * Absent reads as active: a backend that predates the field sends no
 * `status`, and badging every branch as hidden on such a backend would be a
 * false alarm on the whole network.
 */
export const isBranchInactive = (status: BranchStatus | undefined): boolean =>
  status === BRANCH_STATUS.Inactive;

/** The effective state of a branch payload, with the same "absent = active" rule. */
export const branchStatusOf = (status: BranchStatus | undefined): BranchStatus =>
  status ?? DEFAULT_BRANCH_STATUS;
