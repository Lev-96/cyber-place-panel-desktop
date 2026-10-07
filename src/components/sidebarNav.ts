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
}

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: ReactNode;
}

/**
 * The side menu's entries for one role, in alphabetical order of their label
 * in the current language (2026-10-07). Armenian sorts in Armenian alphabetical
 * order. Equal labels keep the order they were declared in.
 */
export const sortedNavItems = (
  specs: NavItemSpec[],
  t: (key: string) => string,
  lang: Lang | undefined,
): NavItem[] =>
  specs
    .filter((spec) => spec.show)
    .map((spec, index) => ({ to: spec.to, label: t(spec.labelKey), end: spec.end, badge: spec.badge, index }))
    .sort((a, b) => compareText(a.label, b.label, lang ?? "en") || a.index - b.index)
    .map(({ index: _index, ...item }) => item);
