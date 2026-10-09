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
}

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: ReactNode;
}

/**
 * The side menu's entries for one role: the pinned ones first (the Dashboard),
 * in declared order, then the rest in alphabetical order of their label in the
 * current language (2026-10-07). Armenian sorts in Armenian alphabetical
 * order. Equal labels keep the order they were declared in.
 */
export const sortedNavItems = (
  specs: NavItemSpec[],
  t: (key: string) => string,
  lang: Lang | undefined,
): NavItem[] =>
  specs
    .filter((spec) => spec.show)
    .map((spec, index) => ({
      to: spec.to, label: t(spec.labelKey), end: spec.end, badge: spec.badge, index, pinned: spec.pinnedFirst === true,
    }))
    .sort((a, b) =>
      Number(b.pinned) - Number(a.pinned)
      || (a.pinned ? 0 : compareText(a.label, b.label, lang ?? "en"))
      || a.index - b.index)
    .map(({ index: _index, pinned: _pinned, ...item }) => item);
