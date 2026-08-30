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
  /**
   * Admin-only "Метрики" section: Yandex.Metrica web analytics for the public
   * landing page, plus the entry point to the backend's Pulse dashboard.
   * Network-wide data (whole-product traffic and server health), so it is not
   * a single company owner's to read — the backend enforces the same on the
   * `admin` guard.
   */
  | "menu.metrics"
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
  /**
   * The branch's bookable seats (`/branches/:id/places`). Owner-level: adding,
   * re-pricing or deleting a seat changes what the venue sells and what a
   * player can book, and deleting one now takes its device and its session
   * history with it. A manager runs the floor that is already laid out.
   */
  | "branch.places"
  /**
   * Member cards and deposits (`/branches/:id/members`). Administrative: it
   * holds player identities and stored balances, and nothing on the cashier
   * path needs it — the POS charges cash and never reads a member.
   */
  | "branch.members"
  /**
   * The branch's product catalogue — create, edit, delete, show/hide. Reading
   * it needs no permission: every role sells from it at the POS, and a manager
   * gets the list plus search, without a write control anywhere.
   */
  | "product.crud"
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
  /**
   * Cashier shifts — open, close, Z-report. Declared since the first version of
   * this map and read by nothing until now; the section was open to everyone.
   * Owner-level from 2026-08-30: the shift is the cash-accountability record
   * the company answers for. A sale still works without an open shift
   * (`orders.cashier_shift_id` is nullable), so a manager who cannot open one
   * can still ring up a customer.
   */
  | "shift.open"
  /**
   * Administratively block a company / a single branch: it disappears from the
   * player-facing app, takes no bookings, and its staff cannot sign in.
   *
   * Admin only, and deliberately NOT implied by `company.edit` / `branch.edit`.
   * An owner may edit their own company all day, but the block exists to be
   * used AGAINST that company (unpaid invoice, abuse, a venue that must stop
   * trading today) — so its owner must not be able to lift it. The backend
   * enforces exactly this on the `admin` guard; the permission only decides
   * whether the button is drawn.
   */
  | "company.block"
  | "branch.block";

const PERMS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "menu.branches", "menu.companies", "menu.managers", "menu.games",
    "menu.tournaments", "menu.scan", "menu.map",
    "menu.updates", "menu.expenses", "menu.metrics",
    "revenue.view",
    "branch.create", "branch.edit", "branch.delete", "branch.prices",
    "branch.places", "branch.members", "product.crud",
    "company.create", "company.edit", "company.delete",
    "company.block", "branch.block",
    "manager.create", "manager.delete",
    "game.crud", "game.crud.branch", "expenses.crud",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
  company_owner: new Set<Permission>([
    "menu.branches", "menu.managers", "menu.tournaments", "menu.scan", "menu.map",
    "menu.myCompany", "menu.agentUpdates", "revenue.view",
    "branch.create", "branch.edit", "branch.delete", "branch.prices",
    // Seats, shifts and the product catalogue are the company's to arrange;
    // "branch.members" is deliberately NOT here — member cards and deposits are
    // administrative, and the section is gone from an owner's branch.
    "branch.places", "product.crud",
    // Owners manage their branches' game libraries (branch-scoped games):
    // hub tile + place-modal inline create. The shared catalogue itself
    // ("game.crud") stays admin-only — that is what the backend enforces.
    "game.crud.branch",
    "company.edit",
    "manager.create", "manager.delete",
    "session.start", "session.stop", "pos.charge", "shift.open",
  ]),
  manager: new Set<Permission>([
    // Manager = single-branch floor staff, and the floor is what they get: run
    // sessions, ring up sales, read the product list. No global lists, no CRUD
    // of branches/companies, and — since 2026-08-30 — no branch profile, no
    // seats, no shifts, no member cards and no product writes. Those are the
    // company's arrangements; a manager works inside them.
    //
    // The branch profile was already refused server-side (a manager
    // branch-update is rejected); the rest is enforced the same way now, so
    // removing a screen is not merely hiding a button.
    "menu.tournaments", "menu.scan", "menu.agentUpdates",
    // Games stay: a manager runs the library of the branch they work at, and
    // the place form's inline "create game" dead-ends without it. Branch-scoped
    // only — never the shared catalogue.
    "game.crud.branch",
    "session.start", "session.stop", "pos.charge",
  ]),
};

export const can = (role: Role | undefined | null, perm: Permission): boolean => {
  if (!role) return false;
  return PERMS[role]?.has(perm) ?? false;
};
