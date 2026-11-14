import { moveOnto } from "@/utils/reorder";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Reordering a vertical list by dragging a handle (2026-11-13, first used by
 * the side-menu editor on «Интерфейс и тема»).
 *
 * Pointer Events, not HTML5 drag events: those never fire for a finger, and
 * this list must work with a mouse in Electron AND with a finger in the owner
 * web (phone browser, installed PWA, Telegram Mini App). The handle alone has
 * `touch-action: none` (the consumer's CSS), so a swipe on the rest of a row
 * still scrolls the page. The handle is also a keyboard control: Space or
 * Enter picks the item up, the arrows (Home / End) move it, Space or Enter
 * drops it, Escape (or leaving the handle) puts it back.
 *
 * What the hook does: tracks one drag, computes the slot the item would land
 * in, moves the lifted item with `translate` written straight to its element
 * (no React render per pointer frame), tells the other items which way to
 * slide (`data-sort-state`), scrolls the nearest scroll container near its
 * edges, and on drop calls `onMove(from, to)` once. What it does NOT do:
 * reorder anything itself (the owner of the list does, typically with
 * {@link moveIndex}), or decide how anything looks (the consumer's CSS reads
 * the attributes and custom properties below).
 *
 * Contract with the consumer's markup:
 *  - the list element gets `listProps` (`data-sorting` while a drag is on,
 *    `--sort-shift` = how far the others slide, `--sort-slot-y` /
 *    `--sort-slot-h` = where the drop slot is, relative to the list's top);
 *  - each sortable item gets `itemProps(id)` (`data-sort-state` = "lifted" |
 *    "shift-up" | "shift-down"); after a drop or cancel the item glides into
 *    place under `data-sort-settling`, and a cancel marks the list
 *    `data-sort-returning` while the others slide back;
 *  - each item's handle (a `<button>`) gets `handleProps(id)`.
 * Motion belongs to CSS: under reduced motion the consumer simply has no
 * transitions, and everything snaps.
 *
 * Items must be distinct ids and laid out top to bottom in `ids` order.
 */

/**
 * `list` with the item at `from` moved so it ends at index `to` (clamped to
 * the list). Out-of-range `from` or the same index is a no-op that returns a
 * copy in the same order. Delegates to the one reorder rule (`moveOnto`): the
 * item takes the target's slot.
 */
export const moveIndex = <T>(list: readonly T[], from: number, to: number): T[] => {
  if (!Number.isInteger(from) || from < 0 || from >= list.length) return [...list];
  const at = Math.min(Math.max(Math.trunc(to), 0), list.length - 1);
  if (at === from) return [...list];
  return moveOnto(list, list[from], list[at]);
};

/** Positions are 1-based for people. */
export interface SortableMessages {
  pickedUp: (id: string, position: number, total: number) => string;
  moved: (id: string, position: number, total: number) => string;
  dropped: (id: string, position: number, total: number) => string;
  cancelled: (id: string, position: number, total: number) => string;
}

export interface SortableOptions {
  /** The sortable items, in display order. */
  ids: readonly string[];
  /** Called once per drop that changes the order. */
  onMove: (from: number, to: number) => void;
  /** Words for the screen-reader announcement (`announcement`). */
  messages: SortableMessages;
}

export type SortState = "lifted" | "shift-up" | "shift-down";
type Mode = "pointer" | "keyboard";

type SortableStyle = CSSProperties & {
  "--sort-shift"?: string;
  "--sort-slot-y"?: string;
  "--sort-slot-h"?: string;
};

export interface SortableList<L extends HTMLElement, I extends HTMLElement, H extends HTMLElement> {
  listProps: { ref: (el: L | null) => void; "data-sorting"?: Mode; style?: SortableStyle };
  itemProps: (id: string) => { ref: (el: I | null) => void; "data-sort-state"?: SortState };
  handleProps: (id: string) => {
    "data-sort-handle": "";
    "aria-pressed": boolean;
    onPointerDown: (e: ReactPointerEvent<H>) => void;
    onPointerMove: (e: ReactPointerEvent<H>) => void;
    onPointerUp: (e: ReactPointerEvent<H>) => void;
    onPointerCancel: (e: ReactPointerEvent<H>) => void;
    onLostPointerCapture: (e: ReactPointerEvent<H>) => void;
    onKeyDown: (e: ReactKeyboardEvent<H>) => void;
    onBlur: () => void;
    onContextMenu: (e: { preventDefault: () => void }) => void;
  };
  /** The item being moved, or null. */
  activeId: string | null;
  /** The latest announcement for an `aria-live` region. */
  announcement: string;
}

/** Distance from the scroll container's edge at which auto-scroll starts. */
const EDGE_PX = 80;
/** Auto-scroll speed at the very edge, px per frame. */
const MAX_SCROLL_STEP = 18;
/** How long the others take to slide back after a cancel (≥ the CSS transition). */
const RETURN_MS = 260;

interface Geometry {
  tops: number[];
  bottoms: number[];
  listTop: number;
  /** The lifted item's height + the gap below it: how far the others slide. */
  shift: number;
}

interface Session {
  id: string;
  from: number;
  to: number;
  mode: Mode;
  key: string;
  geo: Geometry;
  el: HTMLElement;
  pointerId: number;
  startY: number;
  lastY: number;
  scroller: HTMLElement;
  startScroll: number;
  raf: number;
}

interface Snapshot {
  id: string;
  from: number;
  to: number;
  mode: Mode;
  shift: number;
  slotY: number;
  slotH: number;
}

const isScrollable = (el: HTMLElement): boolean => {
  const { overflowY } = getComputedStyle(el);
  return (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && el.scrollHeight > el.clientHeight;
};

/** The nearest ancestor that scrolls vertically, else the document's scroller. */
const scrollerOf = (el: HTMLElement): HTMLElement => {
  const root = (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
  for (let p = el.parentElement; p && p !== root && p !== document.body; p = p.parentElement) {
    if (isScrollable(p)) return p;
  }
  return root;
};

/** The part of the viewport where `scroller` shows its content. */
const visibleBand = (scroller: HTMLElement): { top: number; bottom: number } => {
  const root = document.scrollingElement ?? document.documentElement;
  if (scroller === root) return { top: 0, bottom: window.innerHeight };
  const r = scroller.getBoundingClientRect();
  return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, window.innerHeight) };
};

/** Where the lifted item's top ends up if dropped at `to`. */
const landingTop = (geo: Geometry, from: number, to: number): number => {
  if (to > from) return geo.bottoms[to] - (geo.bottoms[from] - geo.tops[from]);
  if (to < from) return geo.tops[to];
  return geo.tops[from];
};

/** The slot the lifted item's centre is over, given how far it has moved. */
const slotFor = (geo: Geometry, from: number, dy: number): number => {
  const mid = (i: number) => (geo.tops[i] + geo.bottoms[i]) / 2;
  const centre = mid(from) + dy;
  let to = from;
  for (let j = from + 1; j < geo.tops.length && centre >= mid(j); j++) to = j;
  if (to === from) for (let j = from - 1; j >= 0 && centre <= mid(j); j--) to = j;
  return to;
};

const keyOf = (ids: readonly string[]): string => ids.join("\u0000");

export function useSortableList<
  L extends HTMLElement = HTMLElement,
  I extends HTMLElement = HTMLElement,
  H extends HTMLElement = HTMLElement,
>({ ids, onMove, messages }: SortableOptions): SortableList<L, I, H> {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const session = useRef<Session | null>(null);
  const listEl = useRef<L | null>(null);
  const itemEls = useRef(new Map<string, I>());
  const itemRefs = useRef(new Map<string, (el: I | null) => void>());
  const settle = useRef<{ id: string; top: number; refocus: boolean } | null>(null);
  const returnTimer = useRef(0);
  // The latest props, for handlers that outlive a render (window listeners, rAF).
  const latest = useRef({ ids, onMove, messages });
  latest.current = { ids, onMove, messages };
  const index = useMemo(() => new Map(ids.map((id, i) => [id, i])), [ids]);

  const publish = useCallback((s: Session) => {
    const slotH = s.geo.bottoms[s.from] - s.geo.tops[s.from];
    setSnap({
      id: s.id, from: s.from, to: s.to, mode: s.mode, shift: s.geo.shift,
      slotY: landingTop(s.geo, s.from, s.to) - s.geo.listTop, slotH,
    });
  }, []);

  const scrollPos = (s: Session) => s.scroller.scrollTop;

  /** Moves the lifted item by `dy` (pointer) and re-targets the slot. */
  const follow = useCallback((s: Session) => {
    const { geo, from } = s;
    const last = geo.tops.length - 1;
    const raw = s.lastY - s.startY + (scrollPos(s) - s.startScroll);
    // The row never leaves the list's own box.
    const dy = Math.min(Math.max(raw, geo.tops[0] - geo.tops[from]), geo.bottoms[last] - geo.bottoms[from]);
    s.el.style.translate = `0 ${dy}px`;
    const to = slotFor(geo, from, dy);
    if (to !== s.to) {
      s.to = to;
      publish(s);
    }
  }, [publish]);

  const stopAutoScroll = (s: Session) => {
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  };

  const autoScroll = useCallback(() => {
    const s = session.current;
    if (!s || s.mode !== "pointer") return;
    s.raf = 0;
    const band = visibleBand(s.scroller);
    const edge = Math.min(EDGE_PX, (band.bottom - band.top) / 4);
    let step = 0;
    if (s.lastY < band.top + edge) step = -Math.ceil(MAX_SCROLL_STEP * Math.min(1, (band.top + edge - s.lastY) / edge));
    else if (s.lastY > band.bottom - edge) step = Math.ceil(MAX_SCROLL_STEP * Math.min(1, (s.lastY - (band.bottom - edge)) / edge));
    if (step === 0) return;
    const before = scrollPos(s);
    s.scroller.scrollTop = before + step;
    if (scrollPos(s) === before) return; // at the end: nothing more to scroll
    follow(s);
    s.raf = requestAnimationFrame(autoScroll);
  }, [follow]);

  /** Ends the drag; commits the move when `commit` and the slot changed. */
  const finish = useCallback((commit: boolean) => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    stopAutoScroll(s);
    settle.current = { id: s.id, top: s.el.getBoundingClientRect().top, refocus: s.mode === "keyboard" };
    const total = s.geo.tops.length;
    const { onMove: move, messages: say } = latest.current;
    const moved = commit && s.to !== s.from;
    if (!moved && s.to !== s.from) {
      // Cancelled after the others slid apart: let them slide back.
      const list = listEl.current;
      if (list) {
        list.setAttribute("data-sort-returning", "");
        window.clearTimeout(returnTimer.current);
        returnTimer.current = window.setTimeout(() => list.removeAttribute("data-sort-returning"), RETURN_MS);
      }
    }
    setSnap(null);
    if (moved) move(s.from, s.to);
    if (moved) setAnnouncement(say.dropped(s.id, s.to + 1, total));
    else if (s.mode === "keyboard" || s.to !== s.from) setAnnouncement(say.cancelled(s.id, s.from + 1, total));
  }, []);

  /** Starts a drag of `id`; null when it cannot start (unknown id, not laid out). */
  const begin = (id: string, mode: Mode, pointerId: number, y: number): Session | null => {
    const { ids: list } = latest.current;
    const from = list.indexOf(id);
    const el = itemEls.current.get(id);
    const listNode = listEl.current;
    if (from < 0 || !el || !listNode) return null;
    // A previous drop may still be gliding into place.
    for (const node of itemEls.current.values()) {
      node.removeAttribute("data-sort-settling");
      node.style.translate = "";
    }
    const rects = list.map((x) => itemEls.current.get(x)?.getBoundingClientRect());
    if (rects.some((r) => r === undefined)) return null;
    const tops = rects.map((r) => r?.top ?? 0);
    const bottoms = rects.map((r) => r?.bottom ?? 0);
    const gap = from + 1 < list.length ? tops[from + 1] - bottoms[from] : from > 0 ? tops[from] - bottoms[from - 1] : 0;
    const scroller = scrollerOf(listNode);
    const s: Session = {
      id, from, to: from, mode, key: keyOf(list),
      geo: { tops, bottoms, listTop: listNode.getBoundingClientRect().top, shift: bottoms[from] - tops[from] + gap },
      el, pointerId, startY: y, lastY: y, scroller, startScroll: scroller.scrollTop, raf: 0,
    };
    session.current = s;
    publish(s);
    return s;
  };

  // Keyboard: the lifted item sits exactly in its slot.
  const placeAtSlot = (s: Session) => {
    s.el.style.translate = `0 ${landingTop(s.geo, s.from, s.to) - s.geo.tops[s.from]}px`;
    s.el.scrollIntoView?.({ block: "nearest" });
  };

  // While a pointer drag is on: Escape cancels, losing the window cancels.
  const pointerDragging = snap?.mode === "pointer";
  useEffect(() => {
    if (!pointerDragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    const onBlur = () => finish(false);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [pointerDragging, finish]);

  // The list changed under a drag (another tab saved, a role change): the
  // measured slots are stale, so the drag is abandoned rather than misplaced.
  const idsKey = keyOf(ids);
  useEffect(() => {
    if (session.current && session.current.key !== idsKey) finish(false);
  }, [idsKey, finish]);

  // Unmounted mid-drag: no loop or timer survives.
  useEffect(() => () => {
    if (session.current) stopAutoScroll(session.current);
    session.current = null;
    window.clearTimeout(returnTimer.current);
  }, []);

  // After a drop or cancel commits: glide the item from where it was seen to
  // where it now is (FLIP). Without a CSS transition (reduced motion) it snaps.
  useLayoutEffect(() => {
    const s = settle.current;
    if (!s || snap) return;
    settle.current = null;
    const el = itemEls.current.get(s.id);
    if (!el) return;
    el.style.translate = "";
    const delta = s.top - el.getBoundingClientRect().top;
    if (Math.abs(delta) >= 0.5) {
      el.style.translate = `0 ${delta}px`;
      el.setAttribute("data-sort-settling", "");
      void el.getBoundingClientRect(); // the start of the glide is laid out first
      el.style.translate = "";
      const done = () => {
        el.removeAttribute("data-sort-settling");
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
      window.setTimeout(done, RETURN_MS);
    }
    if (s.refocus) {
      const handle = el.querySelector<HTMLElement>("[data-sort-handle]");
      if (handle && document.activeElement !== handle) handle.focus();
    }
  });

  const itemRef = (id: string) => {
    let ref = itemRefs.current.get(id);
    if (!ref) {
      ref = (el: I | null) => {
        if (el) itemEls.current.set(id, el);
        else itemEls.current.delete(id);
      };
      itemRefs.current.set(id, ref);
    }
    return ref;
  };

  const stateOf = (id: string): SortState | undefined => {
    if (!snap) return undefined;
    if (id === snap.id) return "lifted";
    const i = index.get(id);
    if (i === undefined) return undefined;
    if (snap.to > snap.from && i > snap.from && i <= snap.to) return "shift-up";
    if (snap.to < snap.from && i >= snap.to && i < snap.from) return "shift-down";
    return undefined;
  };

  const listRef = useCallback((el: L | null) => { listEl.current = el; }, []);

  const handleProps = (id: string): ReturnType<SortableList<L, I, H>["handleProps"]> => ({
    "data-sort-handle": "",
    "aria-pressed": snap?.id === id,
    onPointerDown: (e) => {
      // A second finger, a right or middle button, or a drag already on.
      if (!e.isPrimary || e.button !== 0) return;
      if (session.current) {
        if (session.current.mode !== "keyboard") return;
        finish(false);
      }
      const s = begin(id, "pointer", e.pointerId, e.clientY);
      if (!s) return;
      const target = e.currentTarget;
      if (typeof target.setPointerCapture === "function") {
        try { target.setPointerCapture(e.pointerId); } catch { /* not capturable: still tracked on the handle */ }
      }
    },
    onPointerMove: (e) => {
      const s = session.current;
      if (!s || s.mode !== "pointer" || e.pointerId !== s.pointerId) return;
      s.lastY = e.clientY;
      follow(s);
      if (!s.raf) s.raf = requestAnimationFrame(autoScroll);
    },
    onPointerUp: (e) => {
      const s = session.current;
      if (!s || s.mode !== "pointer" || e.pointerId !== s.pointerId) return;
      finish(true);
    },
    onPointerCancel: (e) => {
      const s = session.current;
      if (!s || s.mode !== "pointer" || e.pointerId !== s.pointerId) return;
      finish(false);
    },
    onLostPointerCapture: (e) => {
      // After a pointerup the drag is already over; anything else lost it.
      const s = session.current;
      if (!s || s.mode !== "pointer" || e.pointerId !== s.pointerId) return;
      finish(false);
    },
    onKeyDown: (e) => {
      const s = session.current;
      const total = latest.current.ids.length;
      const say = latest.current.messages;
      if (!s) {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        const started = begin(id, "keyboard", -1, 0);
        if (started) setAnnouncement(say.pickedUp(id, started.from + 1, total));
        return;
      }
      if (s.mode !== "keyboard" || s.id !== id) return;
      let to = s.to;
      switch (e.key) {
        case "ArrowUp": to = Math.max(0, s.to - 1); break;
        case "ArrowDown": to = Math.min(total - 1, s.to + 1); break;
        case "Home": to = 0; break;
        case "End": to = total - 1; break;
        case " ":
        case "Enter":
          e.preventDefault();
          finish(true);
          return;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          finish(false);
          return;
        default:
          return;
      }
      e.preventDefault();
      if (to === s.to) return;
      s.to = to;
      placeAtSlot(s);
      publish(s);
      setAnnouncement(say.moved(id, to + 1, total));
    },
    onBlur: () => {
      const s = session.current;
      if (s && s.mode === "keyboard" && s.id === id) finish(false);
    },
    onContextMenu: (e) => e.preventDefault(),
  });

  return {
    listProps: {
      ref: listRef,
      "data-sorting": snap?.mode,
      style: snap
        ? { "--sort-shift": `${snap.shift}px`, "--sort-slot-y": `${snap.slotY}px`, "--sort-slot-h": `${snap.slotH}px` }
        : undefined,
    },
    itemProps: (id) => ({ ref: itemRef(id), "data-sort-state": stateOf(id) }),
    handleProps,
    activeId: snap?.id ?? null,
    announcement,
  };
}
