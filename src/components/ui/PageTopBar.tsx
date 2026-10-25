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
      watched = el;
      setTitle(el?.textContent?.trim() || null);
      setShown(false);
      if (!el || typeof IntersectionObserver === "undefined") return;
      io = new IntersectionObserver(
        // Out of view ABOVE the bar — not merely below the fold.
        ([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)),
        { root: main, rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`, threshold: 0 },
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
