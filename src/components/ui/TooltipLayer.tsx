import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * One tooltip for the whole panel (2026-11-07, owner): fast, small, never in
 * the way. Mounted once at the app root.
 *
 * What gets one:
 * - any element with `data-tip="…"` (the text), anywhere;
 * - any element with a native `title` inside a `[data-tip-scope]` container
 *   (the Active Places board, its dialogs) — so every icon-only button,
 *   truncated name, joystick, extra, booking and console chip there that
 *   already says what it is in `title` gets the same bubble without each
 *   component learning a new prop.
 *
 * While the bubble is up the native `title` is parked in `data-tip-title`
 * (otherwise the OS tooltip would show as well) and put back on leave — the
 * element's accessible name never depends on it: the bubble is linked with
 * `aria-describedby` while shown, and the components keep their aria-label.
 *
 * Never in the way: the bubble takes no pointer events, a press, a drag, a
 * scroll, Escape or the window losing focus hide it at once, and it never
 * shows while a mouse button is down.
 */

const SHOW_DELAY_MS = 220;
const GAP = 8;
const EDGE = 8;

export interface Box { left: number; top: number; width: number; height: number }

/**
 * Where the bubble goes: centred above the element, below it when there is no
 * room above, and slid along so it never leaves the window.
 */
export const placeTooltip = (
  target: Box,
  bubble: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number; side: "top" | "bottom" } => {
  const roomAbove = target.top - GAP - bubble.height >= EDGE;
  const roomBelow = target.top + target.height + GAP + bubble.height <= viewport.height - EDGE;
  const side = roomAbove || !roomBelow ? "top" : "bottom";
  const rawTop = side === "top" ? target.top - GAP - bubble.height : target.top + target.height + GAP;
  const top = Math.max(EDGE, Math.min(rawTop, viewport.height - EDGE - bubble.height));
  const centred = target.left + target.width / 2 - bubble.width / 2;
  const left = Math.max(EDGE, Math.min(centred, viewport.width - EDGE - bubble.width));
  return { left, top, side };
};

const TIP_ID = "cp-tooltip";

/** The element under `node` that carries a tooltip, if any. */
const tipTarget = (node: EventTarget | null): HTMLElement | null => {
  let el = node instanceof Element ? node : null;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement) {
      if (el.dataset.tip) return el;
      if ((el.getAttribute("title") || el.dataset.tipTitle) && el.closest("[data-tip-scope]")) return el;
    }
    el = el.parentElement;
  }
  return null;
};

const textOf = (el: HTMLElement): string =>
  (el.dataset.tip || el.getAttribute("title") || el.dataset.tipTitle || "").trim();

interface Shown { text: string; target: HTMLElement }

const TooltipLayer = () => {
  const [shown, setShown] = useState<Shown | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; side: "top" | "bottom" } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<HTMLElement | null>(null);
  const buttonsDown = useRef(false);

  useEffect(() => {
    const restore = (el: HTMLElement) => {
      const parked = el.dataset.tipTitle;
      if (parked !== undefined) {
        // Put the native title back unless React wrote a new one meanwhile.
        if (!el.hasAttribute("title")) el.setAttribute("title", parked);
        delete el.dataset.tipTitle;
      }
      if (el.getAttribute("aria-describedby") === TIP_ID) el.removeAttribute("aria-describedby");
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      if (current.current) restore(current.current);
      current.current = null;
      setShown(null);
      setPos(null);
    };
    const show = (el: HTMLElement) => {
      const text = textOf(el);
      if (!text || !el.isConnected) return;
      if (!el.hasAttribute("aria-describedby")) el.setAttribute("aria-describedby", TIP_ID);
      setShown({ text, target: el });
    };
    const arm = (el: HTMLElement, delay: number) => {
      if (current.current === el) return;
      hide();
      current.current = el;
      // Park the native title right away, so the OS tooltip never races ours.
      if (el.hasAttribute("title")) {
        el.dataset.tipTitle = el.getAttribute("title") ?? "";
        el.removeAttribute("title");
      }
      timer.current = window.setTimeout(() => { if (current.current === el) show(el); }, delay);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch" || buttonsDown.current) return;
      const el = tipTarget(e.target);
      if (!el) { if (current.current && !current.current.contains(e.target as Node)) hide(); return; }
      arm(el, SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      const el = current.current;
      if (el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = tipTarget(e.target);
      // Keyboard focus only: a click focuses too, and must not pop a bubble.
      if (el && el.matches(":focus-visible")) arm(el, 0);
    };
    const onBlur = () => hide();
    const onDown = () => { buttonsDown.current = true; hide(); };
    const onUp = () => { buttonsDown.current = false; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onBlur, true);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    document.addEventListener("dragstart", hide, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onBlur, true);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      document.removeEventListener("dragstart", hide, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("resize", hide);
    };
  }, []);

  // Measure once the text is in, then place.
  useEffect(() => {
    if (!shown || !bubbleRef.current) return;
    const r = shown.target.getBoundingClientRect();
    const b = bubbleRef.current.getBoundingClientRect();
    setPos(placeTooltip(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      { width: b.width, height: b.height },
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, [shown]);

  if (!shown) return null;
  return createPortal(
    <div
      ref={bubbleRef}
      id={TIP_ID}
      role="tooltip"
      className={`cp-tooltip${pos ? " is-shown" : ""}`}
      data-side={pos?.side ?? "top"}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {shown.text}
    </div>,
    document.body,
  );
};

export default TooltipLayer;
