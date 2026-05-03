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
  | "menu.servicesAdmin"   // see global Services CRUD
  | "menu.tournaments"     // see Tournaments in sidebar
  | "menu.scan"            // see Scan/Confirm in sidebar
  | "menu.map"             // see Branches map in sidebar
  | "menu.myCompany"       // owner shortcut to their own company
  | "revenue.view"         // see /revenue and /companies/:id/revenue (admin + owner)
  // branch CRUD
  | "branch.create"
  | "branch.edit"
  | "branch.delete"
  // Hourly-rate matrix + time packages — the player-facing tariff
  // sheet. Admin/owner/manager all need it: manager runs the floor
  // and is the one editing prices when they shift.
  | "branch.prices"
  // company CRUD
  | "company.create"
  | "company.edit"
  | "company.delete"
  // managers CRUD
  | "manager.create"
  | "manager.delete"
  // global lookups
  | "game.crud"
  | "service.crud"
  // cashier ops (everyone with a branch can do these)
  | "session.start"
  | "session.stop"
  | "pos.charge"
  | "shift.open";

const PERMS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "menu.branches", "menu.companies", "menu.managers", "menu.games",
    "menu.servicesAdmin", "menu.tournaments", "menu.scan", "menu.map",
    "revenue.view",
    "branch.create", "branch.edit", "branch.delete", "branch.prices",
    "company.create", "company.edit", "company.delete",
    "manager.create", "manager.delete",
    "game.crud", "service.crud",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
  company_owner: new Set<Permission>([
    "menu.branches", "menu.managers", "menu.tournaments", "menu.scan", "menu.map",
    "menu.myCompany", "revenue.view",
    "branch.create", "branch.edit", "branch.delete", "branch.prices",
    "company.edit",
    "manager.create", "manager.delete",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
  manager: new Set<Permission>([
    // Manager = single-branch staff. No global lists, no CRUD of
    // branches/companies. Edits their own branch info AND its prices
    // — managers run the floor and need to adjust rates when they
    // shift (e.g. peak-hour vs off-peak).
    "menu.tournaments", "menu.scan",
    "branch.edit", "branch.prices",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
};

export const can = (role: Role | undefined | null, perm: Permission): boolean => {
  if (!role) return false;
  return PERMS[role]?.has(perm) ?? false;
};
