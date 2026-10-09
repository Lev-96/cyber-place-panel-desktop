import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Does a row of controls fit on ONE line in the width it is given?
 *
 * The caller renders two things inside `containerRef`:
 *  - the real control (a button row when it fits, something compact when not);
 *  - an ALWAYS-rendered hidden copy of the full row in `measureRef`
 *    (aria-hidden, `visibility: hidden`, absolutely positioned, `nowrap`,
 *    same classes and labels), whose natural width is what the row needs.
 *
 * `fits` is `measure.scrollWidth <= container.clientWidth`, recomputed when
 * either box resizes (ResizeObserver on BOTH: the container when the window or
 * the dialog changes, the measure row when labels change — language switch,
 * a custom platform loading late, a web font arriving) and when `deps` change.
 *
 * No feedback loop, by construction: the measure row is rendered in both modes
 * so its width never depends on `fits`, and the container's width must not
 * depend on its content (the caller gives it `width: 100%`, `min-width: 0` and
 * `contain: inline-size`). State is set only when the answer flips, so a
 * resize that keeps the answer costs no render.
 *
 * Without ResizeObserver, or before layout (zero width — jsdom, a hidden tab),
 * the answer is `true`: the full row, which is what the control always was.
 */
export const useFitsInline = <C extends HTMLElement = HTMLDivElement, M extends HTMLElement = HTMLDivElement>(
  deps: readonly unknown[],
) => {
  const containerRef = useRef<C>(null);
  const measureRef = useRef<M>(null);
  const [fits, setFits] = useState(true);
  const fitsRef = useRef(true);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || typeof ResizeObserver === "undefined") return;
    const available = container.clientWidth;
    const next = available <= 0 || measure.scrollWidth <= available;
    if (next === fitsRef.current) return;
    fitsRef.current = next;
    setFits(next);
  }, []);

  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => recompute());
    if (containerRef.current) ro.observe(containerRef.current);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => ro.disconnect();
  }, [recompute]);

  // Options or language changed: the labels did, so measure before paint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(recompute, [recompute, ...deps]);

  return { containerRef, measureRef, fits };
};
