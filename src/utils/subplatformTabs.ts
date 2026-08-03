import { IBranchSubplatform } from "@/types/api";

/** Named tabs shown before "Other" — Default plus the most-used ones. */
export const MAX_NAMED_TABS = 3;

/**
 * Which subplatforms get a tab.
 *
 * The strip holds at most four: **Default**, up to two of the most-used, and
 * **Other** — everything else is reachable through Other's search. A tab strip
 * that grows with the catalogue stops being a strip; two slots is what fits
 * beside Default and Other without wrapping in the place modal.
 *
 * The one rule that is not "top two by usage": **the current selection always
 * has a tab**. Editing a place that sits on the branch's fifth-most-used
 * subplatform must not open a form where nothing looks selected and the real
 * value is hidden behind Other — so the selection takes one of the used slots,
 * pushing out the least-used visible one. Default keeps its slot regardless.
 *
 * The server already returns the list default-first then by `places_count`, so
 * this preserves the given order rather than re-sorting: two subplatforms with
 * equal usage must not swap between renders and make the tabs jump.
 */
export const visibleSubplatformTabs = (
  all: IBranchSubplatform[],
  selectedId?: number | null,
): IBranchSubplatform[] => {
  if (all.length <= MAX_NAMED_TABS) return all;

  const isDefault = (s: IBranchSubplatform) => s.is_default;

  // Default first, whatever the server order — it is always the first tab.
  const defaults = all.filter(isDefault);
  const rest = all.filter((s) => !isDefault(s));

  const visible = [...defaults, ...rest].slice(0, MAX_NAMED_TABS);

  const selected = selectedId != null ? all.find((s) => s.id === selectedId) : undefined;
  if (!selected || visible.some((s) => s.id === selected.id)) {
    return visible;
  }

  // Drop the LAST named tab (the least used of the visible ones) rather than
  // the first: Default is not negotiable, and the most-used tab is the one an
  // operator reaches for most often.
  return [...visible.slice(0, MAX_NAMED_TABS - 1), selected];
};

/**
 * Subplatforms that only exist behind "Other" — what its search offers.
 *
 * Derived from the visible set rather than recomputed, so a subplatform can
 * never be both a tab and an "other" entry (which would let the same thing be
 * selected two ways and look like a duplicate).
 */
export const hiddenSubplatforms = (
  all: IBranchSubplatform[],
  visible: IBranchSubplatform[],
): IBranchSubplatform[] => {
  const shown = new Set(visible.map((s) => s.id));

  return all.filter((s) => !shown.has(s.id));
};
