import type { ReactNode } from "react";
import { compareText } from "@/i18n/collation";
import type { Lang } from "@/i18n/translations";

/** One entry of the side menu, before the role and the language decide. */
export interface NavItemSpec {
  to: string;
  labelKey: string;
  show: boolean;
  end?: boolean;
  badge?: ReactNode;
  /**
   * Held at the top whatever the language (2026-10-09): the Dashboard is home,
   * and sorted by its label it landed under П in Russian and Կ in Armenian.
   * Marked on the SPEC (a stable key), never recognised by its label text.
   */
  pinnedFirst?: boolean;
  /**
   * An explicit place (2026-10-11): entries with a rank come right after the
   * pinned ones, by rank ascending, in every language; entries without one
   * follow in alphabetical order. Set from a role's order table keyed by a
   * stable id (see Sidebar), never derived from the label.
   */
  rank?: number;
}

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: ReactNode;
}

/**
 * The side menu's entries for one role, in three bands:
 *  1. pinned (the Dashboard), in declared order;
 *  2. ranked (a role's explicit order, 2026-10-11), by rank — the same in
 *     every language;
 *  3. everything else in alphabetical order of its label in the current
 *     language (2026-10-07; Armenian in Armenian order).
 * Equal labels / ranks keep the order they were declared in, so the result is
 * deterministic.
 */
export const sortedNavItems = (
  specs: NavItemSpec[],
  t: (key: string) => string,
  lang: Lang | undefined,
): NavItem[] =>
  specs
    .filter((spec) => spec.show)
    .map((spec, index) => ({
      to: spec.to, label: t(spec.labelKey), end: spec.end, badge: spec.badge, index,
      band: spec.pinnedFirst === true ? 0 : spec.rank !== undefined ? 1 : 2,
      rank: spec.rank ?? 0,
    }))
    .sort((a, b) =>
      a.band - b.band
      || (a.band === 1 ? a.rank - b.rank : 0)
      || (a.band === 2 ? compareText(a.label, b.label, lang ?? "en") : 0)
      || a.index - b.index)
    .map(({ index: _index, band: _band, rank: _rank, ...item }) => item);

/**
 * The owner's and the manager's menu (2026-10-11): an explicit order and
 * clearer labels, keyed by each entry's stable id (its base label key — never
 * the translated text). Only the SIDE MENU's wording changes: page titles,
 * routes and permissions stay as they are. Entries not listed here (Settings,
 * Agent updates, anything added later) come after these, alphabetically.
 *
 * Admin keeps its own menu: it sees EVERY branch and manager, so "My …" would
 * be false there. A manager's tournaments list is filtered to their branch,
 * so they read "My branch's tournaments", not "Tournaments in all branches".
 */
const STAFF_MENU: Readonly<Record<string, { rank: number; labelKey?: string; managerLabelKey?: string }>> = {
  "nav.myCompany": { rank: 1 },
  "nav.branches": { rank: 2, labelKey: "nav.side.myBranches" },
  // A manager has one branch instead of the list: it takes the same place.
  "nav.myBranch": { rank: 2 },
  "nav.managers": { rank: 3, labelKey: "nav.side.myManagers" },
  "nav.revenue": { rank: 4 },
  "nav.map": { rank: 5, labelKey: "nav.side.branchesOnMap" },
  "nav.scan": { rank: 6, labelKey: "nav.side.scanCode" },
  "nav.bookings": { rank: 7 },
  "nav.notifications": { rank: 8 },
  "nav.tournaments": { rank: 9, labelKey: "nav.side.allTournaments", managerLabelKey: "nav.side.myBranchTournaments" },
};

/** Applies the staff order and labels for an owner or a manager; any other role is returned unchanged. */
export const withStaffMenu = (specs: NavItemSpec[], role: string | undefined): NavItemSpec[] => {
  if (role !== "company_owner" && role !== "manager") return specs;
  return specs.map((spec) => {
    const entry = STAFF_MENU[spec.labelKey];
    if (!entry) return spec;
    const labelKey = (role === "manager" && entry.managerLabelKey) || entry.labelKey || spec.labelKey;
    return { ...spec, rank: entry.rank, labelKey };
  });
};
