/**
 * Drag-and-drop reordering for every list in the panel (2026-10-11): board
 * sections, place tiles, session tiles, hub tiles.
 *
 * Dropping an item ON another item puts it in that item's slot, so the
 * dragged item ends up where the target was: dragged DOWN it lands just
 * after the target, dragged UP just before it. This is the only rule
 * under which every slot can be reached by dropping on a tile:
 *  - the last slot is reached by dropping on the last item;
 *  - the first slot by dropping on the first;
 *  - one step down by dropping on the next item.
 *
 * The old "always in front of the target" rule could not reach the last
 * slot, and treated one step down as no move at all.
 */

/** Which edge of the target the dragged item will land on, for the insertion marker. */
export type DropSide = "before" | "after";

/**
 * `list` with `from` moved into `target`'s slot. A `target` that is null or
 * not in the list sends `from` to the end. A `from` not yet in the list is
 * inserted in front of the target, as if dragged up from below the last item.
 * The input is never mutated, and the result always holds every item exactly
 * once.
 */
export const moveOnto = <T>(list: readonly T[], from: T, target: T | null): T[] => {
  const next = list.filter((x) => x !== from);
  const at = target == null ? -1 : list.indexOf(target);
  if (at < 0) {
    next.push(from);
    return next;
  }
  // `at` is the target's slot in the ORIGINAL list. With `from` taken out
  // above the target, the target shifted up one, so inserting at `at` places
  // `from` after it (moving down). With `from` below or absent, inserting at
  // `at` places it before the target (moving up).
  next.splice(at, 0, from);
  return next;
};

/**
 * Where the marker goes while `from` hovers over `target`: on the target's
 * trailing edge when the drop moves `from` down, otherwise on its leading
 * edge. Null when there is nothing to mark: no drag, the item over itself,
 * or a target not in the list.
 */
export const dropSideOf = <T>(list: readonly T[], from: T | null, target: T): DropSide | null => {
  if (from == null || from === target) return null;
  const to = list.indexOf(target);
  if (to < 0) return null;
  const at = list.indexOf(from);
  return at >= 0 && at < to ? "after" : "before";
};
