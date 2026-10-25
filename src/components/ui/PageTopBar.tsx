import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import BackButton from "./BackButton";

/**
 * The bar pinned to the top of every screen (2026-10-25): Back on the left,
 * and — once the screen's own heading has scrolled away — that heading,
 * centred on the same line, fading in. Scroll back up and it fades out as the
 * real heading returns.
 *
 * One place for every screen: it reads the screen's first `.page-title` (the
 * heading `ScreenWithBg` and every page already render), so no page changes.
 * Click-through except for its own button, so it never blocks the content
 * scrolling under it, nor the tournaments shortcut pinned at the right.
 */
export const pageTitleIn = (main: Element): HTMLElement | null => {
  for (const el of Array.from(main.querySelectorAll<HTMLElement>(".page-title"))) {
    // A heading inside a dialog is the dialog's, not the screen's.
    if (!el.closest(".cp-modal") && !el.closest(".cp-topbar")) return el;
  }
  return null;
};

/** How far below the scroll area's top edge the pinned bar ends. */
export const barBottomInset = (main: Element, bar: HTMLElement): number =>
  Math.round((parseFloat(getComputedStyle(main).paddingTop) || 0) + bar.offsetHeight);

/**
 * Set on the screen's own heading while the bar carries it (2026-10-26), so
 * only ONE name is ever on screen: it fades up out of its place as the bar's
 * copy fades in, and plays its usual entrance again when it comes back.
 */
export const DOCKED_CLASS = "cp-page-title--docked";

const PageTopBar = () => {
  const location = useLocation();
  const barRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    const main = bar?.closest("main");
    if (!bar || !main) return;

    let watched: HTMLElement | null = null;
    let io: IntersectionObserver | null = null;
    let frame = 0;

    // A new screen starts clean: the last screen's heading never lingers on one
    // that has none.
    setTitle(null);
    setShown(false);

    // The heading counts as gone once its bottom has passed under the bar.
    const watch = (el: HTMLElement | null) => {
      if (el === watched) {
        if (el) setTitle(el.textContent?.trim() || null);
        return;
      }
      io?.disconnect();
      io = null;
      watched?.classList.remove(DOCKED_CLASS);
      watched = el;
      setTitle(el?.textContent?.trim() || null);
      setShown(false);
      if (!el || typeof IntersectionObserver === "undefined") return;
      io = new IntersectionObserver(
        // The moment the heading's top reaches the bar (2026-10-26) — not once
        // it has gone entirely: a small scroll used to slide the real heading
        // under Back. From there the band covers it and the bar carries it.
        // Below the fold is not "reached".
        ([entry]) => {
          const docked = entry.intersectionRatio < 1 && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
          setShown(docked);
          el.classList.toggle(DOCKED_CLASS, docked);
        },
        // The bar sticks below the scroll area's top padding, so its bottom is
        // padding + its own height from the top — that is the line to reach.
        { root: main, rootMargin: `-${barBottomInset(main, bar)}px 0px 0px 0px`, threshold: [0, 1] },
      );
      io.observe(el);
    };

    // Screens render their heading after their data: look again whenever the
    // screen's content changes, once per frame. The home dashboard has no
    // heading of its own — only its widgets' — so it shows none.
    const look = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => watch(location.pathname === "/" ? null : pageTitleIn(main)));
    };
    look();
    const mo = new MutationObserver(look);
    mo.observe(main, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io?.disconnect();
      watched?.classList.remove(DOCKED_CLASS);
    };
  }, [location.pathname]);

  return (
    <div ref={barRef} className={`cp-topbar${shown ? " is-titled" : ""}`} data-testid="page-topbar">
      <div className="cp-topbar__side">
        <BackButton />
      </div>
      <div className="cp-topbar__title" aria-hidden={!shown} data-testid="page-topbar-title">
        {title}
      </div>
      <div className="cp-topbar__side" />
    </div>
  );
};

export default PageTopBar;
