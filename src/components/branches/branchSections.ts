import { can } from "@/auth/permissions";
import type { Role } from "@/types/api";

/**
 * The sections inside a branch (2026-11-03): ONE list, read by the branch's
 * own page (the hub's tiles) and by the side menu (the shortcuts a person
 * switches on), so a shortcut can never offer a section the hub does not,
 * or to a role the hub does not.
 *
 * `allowed` mirrors the route's own guard in App.tsx (a test pins the pair).
 * It decides what is OFFERED; the route guard, `BlockedBranchGuard` and the
 * server still decide what may be opened.
 */
export interface BranchSection {
  /** Stable id: the hub's tile key, and the menu shortcut's middle part. */
  key: string;
  /** Path under `/branches/:branchId/`. */
  path: string;
  titleKey: string;
  hintKey: string;
  /** The side menu's icon (NavIcon id). */
  icon: string;
  allowed: (role: Role | undefined) => boolean;
}

const anyone = () => true;

/** In the hub's order. */
export const BRANCH_SECTIONS: readonly BranchSection[] = [
  { key: "sessions", path: "sessions", titleKey: "hub.tile.sessions", hintKey: "hub.tile.sessionsHint", icon: "branch.sessions", allowed: anyone },
  { key: "members", path: "members", titleKey: "hub.tile.members", hintKey: "hub.tile.membersHint", icon: "branch.members", allowed: (r) => can(r, "branch.members") },
  { key: "places", path: "places", titleKey: "hub.tile.places", hintKey: "hub.tile.placesHint", icon: "branch.places", allowed: (r) => can(r, "branch.places") },
  { key: "games", path: "games", titleKey: "hub.tile.games", hintKey: "hub.tile.gamesHint", icon: "nav.games", allowed: (r) => can(r, "game.crud.branch") },
  { key: "pcs", path: "pcs", titleKey: "hub.tile.pcs", hintKey: "hub.tile.pcsHint", icon: "branch.pcs", allowed: anyone },
  { key: "tariffs", path: "tariffs", titleKey: "hub.tile.prices", hintKey: "hub.tile.pricesHint", icon: "branch.tariffs", allowed: (r) => can(r, "branch.prices") },
  { key: "products", path: "products", titleKey: "hub.tile.products", hintKey: "hub.tile.productsHint", icon: "branch.products", allowed: anyone },
  { key: "till", path: "pos", titleKey: "hub.tile.till", hintKey: "hub.tile.tillHint", icon: "branch.till", allowed: anyone },
  { key: "shift", path: "shift", titleKey: "hub.tile.shift", hintKey: "hub.tile.shiftHint", icon: "nav.shifts", allowed: (r) => can(r, "shift.manage") },
  { key: "managers", path: "managers", titleKey: "hub.tile.managers", hintKey: "hub.tile.managersHint", icon: "nav.managers", allowed: (r) => can(r, "manager.create") },
  { key: "tournaments", path: "tournaments", titleKey: "hub.tile.tournaments", hintKey: "hub.tile.tournamentsHint", icon: "nav.tournaments", allowed: anyone },
  { key: "subscribers", path: "subscribers", titleKey: "hub.tile.subscribers", hintKey: "hub.tile.subscribersHint", icon: "branch.subscribers", allowed: anyone },
  // The route has always been guarded by `branch.edit` (the tile once was not).
  { key: "edit", path: "edit", titleKey: "hub.tile.settings", hintKey: "hub.tile.settingsHint", icon: "nav.settings", allowed: (r) => can(r, "branch.edit") },
];

const BY_KEY = new Map(BRANCH_SECTIONS.map((s) => [s.key, s] as const));

export const branchSectionPath = (section: BranchSection, branchId: number): string =>
  `/branches/${branchId}/${section.path}`;

export const branchSectionsFor = (role: Role | undefined): BranchSection[] =>
  BRANCH_SECTIONS.filter((s) => s.allowed(role));

/* ── Menu shortcuts: `branch.<key>.<branchId>` in the person's arrangement ── */

const SHORTCUT = /^branch\.([a-z]{1,20})\.([1-9][0-9]{0,9})$/;

export const branchShortcutId = (key: string, branchId: number): string => `branch.${key}.${branchId}`;

/** The section and branch a shortcut id names, or null (unknown section, malformed id). */
export const parseBranchShortcut = (id: string): { section: BranchSection; branchId: number } | null => {
  const m = SHORTCUT.exec(id);
  if (!m) return null;
  const section = BY_KEY.get(m[1]);
  return section ? { section, branchId: Number(m[2]) } : null;
};
