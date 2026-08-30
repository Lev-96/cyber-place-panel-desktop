import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Place a floating panel next to an element and inside the window.
 *
 * The sidebar clips its children (`overflow: hidden`, so the nav can scroll
 * while the brand and footer stay pinned), which is fine for a popover the
 * width of the card it hangs off and fatal for a wider one: the account
 * switcher is 320px against a ~216px card, and everything past the sidebar's
 * edge was simply cut off. Anchoring it to the window instead of to the card
 * takes it out of that clipping context altogether.
 *
 * Everything here is measured, never assumed. `getBoundingClientRect` reports
 * CSS pixels, so a Windows machine at 125% or 150% scaling is already handled
 * by the browser — there is no DPI branch to get wrong, and no offset that
 * happens to be right at one window size.
 *
 * The panel prefers to sit above its anchor, left edges aligned — where it has
 * always appeared. If that would push it past an edge it is clamped back
 * inside; if there is genuinely no room above, it flips below.
 */
export interface AnchoredPosition {
  /** Ready to spread onto the floating element's `style`. */
  style: { position: "fixed"; left: number; top?: number; bottom?: number; maxHeight: number };
}

const GAP = 6;
const MARGIN = 8;

export const useAnchoredPopover = (
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  width: number,
): AnchoredPosition | null => {
  const [pos, setPos] = useState<AnchoredPosition | null>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Never wider than the window can hold, however wide the caller asked for.
    const w = Math.min(width, vw - MARGIN * 2);

    // Aligned with the anchor's left edge, then pulled back inside if that
    // would hang over either side. `Math.max` last so a window narrower than
    // the panel still starts at the margin rather than at a negative x.
    const left = Math.max(MARGIN, Math.min(rect.left, vw - w - MARGIN));

    const above = rect.top - GAP;
    const below = vh - rect.bottom - GAP;

    setPos(
      above >= below
        // Bottom-anchored so the panel grows upward from the card, which is
        // what keeps it visually attached while its content changes height.
        ? { style: { position: "fixed", left, bottom: vh - rect.top + GAP, maxHeight: Math.max(120, above - MARGIN) } }
        : { style: { position: "fixed", left, top: rect.bottom + GAP, maxHeight: Math.max(120, below - MARGIN) } },
    );
  }, [anchorRef, width]);

  useEffect(() => {
    if (!open) { setPos(null); return; }

    measure();
    // A resize changes everything above; a scroll moves the anchor under a
    // panel that is no longer part of the page flow. Both are cheap to answer
    // and wrong to ignore — a maximise on Windows is a resize.
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  return pos;
};
