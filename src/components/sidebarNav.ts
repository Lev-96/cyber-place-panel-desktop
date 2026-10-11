import type { ReactNode } from "react";
import { compareText } from "@/i18n/collation";
import type { Lang } from "@/i18n/translations";

/** One entry of the side menu, before the role and the language decide. */
export interface NavItemSpec {
  to: string;
  labelKey: string;
  /**
   * The entry's stable id: its BASE label key (`nav.branches`), kept when
   * `withStaffMenu` swaps `labelKey` for a menu-only wording. The icon and the
   * staff order are looked up by it — never by the translated text. Defaults
   * to `labelKey` when absent.
   */
  id?: string;
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
  /** Stable id (base label key) — what `NavIcon` is keyed by. */
  id: string;
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
      id: spec.id ?? spec.labelKey, to: spec.to, label: t(spec.labelKey), end: spec.end, badge: spec.badge, index,
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
  "nav.tournaments": { rank: 8, labelKey: "nav.side.allTournaments", managerLabelKey: "nav.side.myBranchTournaments" },
  "nav.notifications": { rank: 9 },
};

/** Applies the staff order and labels for an owner or a manager; any other role is returned unchanged. */
export const withStaffMenu = (specs: NavItemSpec[], role: string | undefined): NavItemSpec[] => {
  if (role !== "company_owner" && role !== "manager") return specs;
  return specs.map((spec) => {
    const id = spec.id ?? spec.labelKey;
    const entry = STAFF_MENU[id];
    if (!entry) return spec;
    const labelKey = (role === "manager" && entry.managerLabelKey) || entry.labelKey || spec.labelKey;
    return { ...spec, id, rank: entry.rank, labelKey };
  });
};

/** Does `pathname` sit under `to`? An `end` entry matches only exactly. */
const matches = (to: string, end: boolean | undefined, pathname: string): boolean => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === to) return true;
  if (end) return false;
  const base = to.endsWith("/") ? to : `${to}/`;
  return path.startsWith(base);
};

/**
 * The ONE entry to light up for `pathname` (2026-10-11): of the entries whose
 * route contains the page, the most specific — the longest `to`. Each NavLink
 * used to match on its own, so `/bookings/confirm` lit both Scan and Bookings,
 * and `/settings/updates` both Settings and Updates. Detail pages still light
 * their section (`/bookings/5` → Bookings). `null` when nothing matches.
 */
export const activeNavTo = (
  items: ReadonlyArray<Pick<NavItem, "to" | "end">>,
  pathname: string,
): string | null => {
  let best: string | null = null;
  for (const item of items) {
    if (matches(item.to, item.end, pathname) && (best === null || item.to.length > best.length)) {
      best = item.to;
    }
  }
  return best;
};
