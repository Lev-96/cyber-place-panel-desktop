/**
 * How wide Active Places' list rows want to be (2026-11-03), measured for the
 * list's own fit (FitBoardToScreen): its rows at their natural width in the
 * layout they have now, by laying the list's column out as `max-content` for
 * the measurement (CSS keyed on `MEASURE_ATTR`), set and removed in the same
 * frame, never painted. The list's own box, and so its container queries,
 * stay as they are.
 */
export const MEASURE_ATTR = "data-board-measure";

/**
 * Set on the board's container while a list row is too narrow for its
 * buttons' words (2026-11-03): the same buttons in the same places show
 * their pictures instead (`ActionIcon`), the full name kept as the tooltip.
 */
export const ICONS_ATTR = "data-board-icons";

export interface ListWidth {
  /** The widest row's width, in screen pixels at the zoom in force. */
  natural: number;
  /** The room the list has, in screen pixels. */
  room: number;
}

/** Each list on screen with rows: its widest row's natural width and its room. */
export const measureLists = (root: ParentNode): ListWidth[] => {
  const out: ListWidth[] = [];
  for (const grid of Array.from(root.querySelectorAll<HTMLElement>(".live-grid--sessions"))) {
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .place-cell"));
    if (cards.length === 0) continue;
    grid.setAttribute(MEASURE_ATTR, "");
    const natural = Math.max(...cards.map((c) => c.getBoundingClientRect().width));
    grid.removeAttribute(MEASURE_ATTR);
    out.push({ natural, room: grid.getBoundingClientRect().width });
  }
  return out;
};
