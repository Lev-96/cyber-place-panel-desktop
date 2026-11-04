import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import { useEffect } from "react";
import { ICONS_ATTR, measureLists } from "./boardMeasure";

/**
 * Keeping an Active Places LIST whole across its width (2026-11-03).
 *
 * A list row keeps its own size and look while it fits. Where it does not,
 * cheapest first and nothing ever moved, wrapped or cut: the buttons show
 * their pictures instead of their words (`ICONS_ATTR`, same buttons, same
 * places, the name kept as the tooltip — unless the person chose words only,
 * `data-button-labels="text"`, which the stylesheet honours); then, only if
 * the row still does not fit, the list is scaled down AS A WHOLE, in
 * proportion, just enough. Never below `MIN_WIDTH_ZOOM`; past that the list
 * alone scrolls sideways inside its section. The desktop window is not held
 * wider for the list (2026-11-04): it shrinks freely to its 520px base, and
 * this fit is what keeps the list whole.
 *
 * The grid needs none of it (its cards wrap). «Без прокрутки» — shrinking the
 * whole board to the window's height — was removed with its switch on
 * 2026-11-04 (owner).
 *
 * It touches nothing of the board but one CSS variable and one attribute on
 * its container (`--board-fit`, `ICONS_ATTR`), read by the board's zoom and
 * button rules. No data, no handlers, no timers of the board; mounted beside
 * it, its marks go with it.
 */
export const FIT_VAR = "--board-fit";
/**
 * The smallest the width fit may scale a list (2026-11-03): half size keeps
 * the 15px number at 7.5px — the last size a row is still a row. A display
 * smaller than that lets the list scroll sideways instead.
 */
export const MIN_WIDTH_ZOOM = 0.5;

/**
 * The zoom at which every list's widest row fits its room, from rows measured
 * at zoom 1: rows scale linearly with the zoom and the room does not, so it
 * is room / natural — rounded DOWN so a fraction of a pixel never makes a
 * sideways scroll. 1 when they fit as they are.
 */
export const widthZoom = (lists: ReadonlyArray<{ natural: number; room: number }>): number => {
  let z = 1;
  for (const { natural, room } of lists) {
    if (natural > room + 0.5 && natural > 0) z = Math.min(z, room / natural);
  }
  return z >= 1 ? 1 : Math.max(MIN_WIDTH_ZOOM, Math.floor(z * 1000) / 1000);
};

/**
 * Fit the lists inside `target` now and whenever it changes size or gains /
 * loses places. Returns the cleanup. Exported for tests and for the
 * interface preview, which fits its own board the same way.
 */
export const installBoardFit = (target: HTMLElement): (() => void) => {
  const clear = () => {
    target.style.removeProperty(FIT_VAR);
    target.removeAttribute(ICONS_ATTR);
  };
  // All in one frame, so no in-between state is ever painted: measured
  // unscaled, with words (nothing applied after `clear`); pictures if the
  // words do not fit, then the zoom the pictures need.
  const fit = () => {
    clear();
    let f = widthZoom(measureLists(target));
    if (f < 1) {
      target.setAttribute(ICONS_ATTR, "");
      f = widthZoom(measureLists(target));
    }
    if (f < 1) target.style.setProperty(FIT_VAR, String(f));
  };
  let frame = 0;
  const refit = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  };
  refit();

  // The window (the box) and the places on screen (cards in and out, a
  // section folded, a seat started). Childlist only: a running clock edits its
  // text in place and never triggers this.
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refit);
  ro?.observe(target);
  const mo = new MutationObserver(refit);
  mo.observe(target, { childList: true, subtree: true });

  return () => {
    cancelAnimationFrame(frame);
    ro?.disconnect();
    mo.disconnect();
    clear();
  };
};

/**
 * Whether the look on screen is a list (the only board this fits), and a key
 * that changes whenever a row's width could (density, card size, labels,
 * spacing…). One reading for the board and for the interface preview, so
 * the two fit alike.
 */
export const useBoardFitOptions = (): { list: boolean; look: string } => {
  const prefs = useUiPreferencesOptional();
  return {
    list: (prefs?.layout.board_view ?? "grid") === "list",
    look: prefs ? JSON.stringify([prefs.layout, prefs.shown.board]) : "",
  };
};

/** Active Places' own fitter, on the page's scroll area. */
const FitBoardToScreen = () => {
  const { list, look } = useBoardFitOptions();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main.main");
    if (!main || !list) return undefined;
    return installBoardFit(main);
  }, [list, look]);
  return null;
};

export default FitBoardToScreen;
