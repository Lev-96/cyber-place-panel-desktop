import { Role } from "@/types/api";

/**
 * Permission map — mirrors what each role can DO in the RN cyberplace-panel.
 * Single source of truth: route guards, sidebar, and CRUD buttons all read from here.
 */

export type Permission =
  // global navigation
  | "menu.branches"        // see Branches list in sidebar
  | "menu.companies"       // see Companies list in sidebar
  | "menu.managers"        // see global Managers in sidebar
  | "menu.games"           // see Games in sidebar
  | "menu.expenses"        // admin-only recurring-services expense tracker
  | "menu.tournaments"     // see Tournaments in sidebar
  | "menu.scan"            // see Scan/Confirm in sidebar
  | "menu.map"             // see Branches map in sidebar
  | "menu.myCompany"       // owner shortcut to their own company
  | "menu.updates"         // admin-only desktop auto-update screen
  | "menu.agentUpdates"    // owner/manager screen to roll out agent updates to their fleet
  | "revenue.view"         // see /revenue and /companies/:id/revenue (admin + owner)
  // branch CRUD
  | "branch.create"
  | "branch.edit"
  | "branch.delete"
  // Hourly-rate matrix + time packages — the player-facing tariff
  // sheet. Admin/owner only — managers run the floor but pricing is
  // a business decision owned by the company, not the cashier desk.
  | "branch.prices"
  // company CRUD
  | "company.create"
  | "company.edit"
  | "company.delete"
  // managers CRUD
  | "manager.create"
  | "manager.delete"
  // global lookups
  /**
   * The SHARED games catalogue (`/games`). A row there can be attached to any
   * company's branch, so renaming or deleting one is an admin-only decision —
   * the backend services enforce exactly that.
   */
  | "game.crud"
  /**
   * Games of a branch the user actually runs: the branch games library screen
   * and the inline "create game" in the place form. Owners build their
   * branches' libraries; managers need it too — they are the ones registering
   * a place on a custom platform ("other"), and without it the place form
   * dead-ends (no games exist for the new platform and none can be added).
   * The backend applies the same branch scope
   * (`App\Services\Games\GameBranchAuthorizer`).
   */
  | "game.crud.branch"
  // admin recurring-services expense tracker CRUD
  | "expenses.crud"
  // cashier ops (everyone with a branch can do these)
  | "session.start"
  | "session.stop"
  | "pos.charge"
  | "shift.open";

const PERMS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "menu.branches", "menu.companies", "menu.managers", "menu.games",
    "menu.tournaments", "menu.scan", "menu.map",
    "menu.updates", "menu.expenses",
    "revenue.view",
    "branch.create", "branch.edit", "branch.delete", "branch.prices",
    "company.create", "company.edit", "company.delete",
    "manager.create", "manager.delete",
    "game.crud", "game.crud.branch", "expenses.crud",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
  company_owner: new Set<Permission>([
    "menu.branches", "menu.managers", "menu.tournaments", "menu.scan", "menu.map",
    "menu.myCompany", "menu.agentUpdates", "revenue.view",
    "branch.create", "branch.edit", "branch.delete", "branch.prices",
    // Owners manage their branches' game libraries (branch-scoped games):
    // hub tile + place-modal inline create. The shared catalogue itself
    // ("game.crud") stays admin-only — that is what the backend enforces.
    "game.crud.branch",
    "company.edit",
    "manager.create", "manager.delete",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
  manager: new Set<Permission>([
    // Manager = single-branch floor staff. No global lists, no CRUD of
    // branches/companies. Managers do NOT edit the branch profile
    // (address, LOGO, prices) — that is an owner/admin concern and the
    // backend rejects a manager branch-update anyway. The cashier desk
    // sees rates only through StartSessionDialog (already populated).
    "menu.tournaments", "menu.scan", "menu.agentUpdates",
    // Managers register the places they run, including custom-platform ones,
    // so they may add games to THEIR branch's library (branch-scoped only —
    // never the shared catalogue).
    "game.crud.branch",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
};

export const can = (role: Role | undefined | null, perm: Permission): boolean => {
  if (!role) return false;
  return PERMS[role]?.has(perm) ?? false;
};
