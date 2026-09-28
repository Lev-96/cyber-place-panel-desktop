import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import { tActive } from "@/i18n/translations";

interface Props {
  open: boolean;
  onClose?: () => void;
  /** When true, clicking backdrop closes the modal. Default true. */
  closeOnBackdrop?: boolean;
  /**
   * Whether the dialog holds unsaved changes. Leave it out and the modal works
   * it out from the form fields it contains (see `snapshotFields`), which is
   * what every form in the app relies on. Pass it when a form knows better —
   * a value that does not live in a native field.
   */
  dirty?: boolean;
  /**
   * Ask before a close that would throw changes away. Default true; a dialog
   * with nothing to lose never asks either way.
   */
  confirmOnDirty?: boolean;
  children: ReactNode;
}

/** How many modals are currently open — drives the body scroll-lock so stacked
 *  modals release the lock only when the last one closes. */
let openModalCount = 0;

/**
 * The open modals, bottom first. Only the LAST one answers Escape and traps
 * Tab. Every modal used to listen on `window` for itself, so one Escape over a
 * confirmation closed the confirmation AND the form underneath it.
 *
 * Ordered by NESTING, not by when each joined: React runs a child's effects
 * before its parent's, so a dialog opened together with the one inside it
 * would otherwise land ABOVE it. Each entry knows its ancestors, and a modal
 * joins below any of its own descendants already on the stack.
 */
const openStack: Array<{ id: number; ancestors: number[] }> = [];
let nextModalId = 0;

/** The ids of the modals this one is rendered inside, outermost first. */
const AncestorsCtx = createContext<number[]>([]);

/** How long the leave animation runs before the dialog is taken away. */
export const MODAL_LEAVE_MS = 160;

const leaveDelay = (): number =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? 0
    : MODAL_LEAVE_MS;

/**
 * Every value a person could have changed inside the dialog, in document
 * order. COMPARED, not flagged: typing a price and typing the old one back
 * leaves the form clean again. A nested dialog is portaled elsewhere and is
 * never counted as its parent's.
 */
const snapshotFields = (root: HTMLElement): string =>
  JSON.stringify(
    Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    ))
      .filter((el) => !(el instanceof HTMLInputElement && ["hidden", "button", "submit", "reset"].includes(el.type)))
      .map((el) =>
        el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
          ? [el.name, el.type, el.checked]
          : [el.name, el.type, el.value]),
  );

/**
 * Centered modal overlay. The outer `.cp-modal` is the scroll container.
 * The inner `.cp-modal-wrapper` enforces `min-height: 100%` so:
 *   - content shorter than viewport → centered vertically
 *   - content taller than viewport → wrapper grows, .cp-modal scrolls and
 *     the title is always reachable from the top.
 *
 * Backdrop close uses the mousedown→mouseup-on-same-element pattern. A
 * plain `onClick` closed the modal whenever a drag-select started inside
 * an input but the cursor crossed the backdrop on release — same for
 * Ctrl+V flows where users dragged across text. With mousedown bound,
 * we only close when BOTH the press and the release land on the backdrop.
 *
 * Focus is trapped inside the dialog: Tab from the last focusable wraps
 * to the first, Shift+Tab from the first wraps to the last. Without the
 * trap the focus jumps to elements behind the modal, which users read
 * as "the modal closed itself".
 *
 * ## One way to close (2026-09-24)
 *
 * The × in the corner, a backdrop click and Escape all go through
 * `requestClose`: a dialog holding unsaved changes asks «Вы действительно
 * хотите выйти?» (Да / Нет) first; a clean one leaves at once. Leaving is
 * animated — the card fades and settles, THEN `onClose` runs — and a parent
 * that closes the dialog itself while keeping it mounted (`open={false}`)
 * gets the same exit. Cancel and Save are the form's own explicit answers and
 * are not second-guessed: they call the parent directly, as before.
 */
const Modal = ({ open, onClose, closeOnBackdrop = true, dirty, confirmOnDirty = true, children }: Props) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const downOnBackdropRef = useRef(false);
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = ++nextModalId;
  const ancestors = useContext(AncestorsCtx);
  // Set once the parent has been told to close; the render that answers it
  // decides whether it did (see the effect below `leave`).
  const [pendingClose, setPendingClose] = useState(false);

  // Rendered while open, and for the length of the leave animation after.
  const [present, setPresent] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // A close this Modal started (× / backdrop / Escape) has already played its
  // exit, so the parent's `open={false}` that follows must not play it twice.
  const closingRef = useRef(false);
  const leaveTimerRef = useRef<number | null>(null);
  // The fields as they stood before the person first touched anything — taken
  // lazily, so values a form loads after opening belong to the baseline.
  const baselineRef = useRef<string | null>(null);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  // The parent opening or closing the dialog.
  useEffect(() => {
    if (open) {
      clearLeaveTimer();
      closingRef.current = false;
      baselineRef.current = null;
      setLeaving(false);
      setConfirming(false);
      setPresent(true);
      return;
    }

    setConfirming(false);
    if (closingRef.current) {
      // Already faded out on our own request.
      closingRef.current = false;
      setLeaving(false);
      setPresent(false);
      return;
    }

    // Closed by the parent (Cancel, a save): the same exit, then unmount.
    setLeaving(true);
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      setLeaving(false);
      setPresent(false);
    }, leaveDelay());
  }, [open]);

  useEffect(() => () => clearLeaveTimer(), []);

  const isDirty = useCallback((): boolean => {
    if (dirty !== undefined) return dirty;
    const root = dialogRef.current;
    if (!root || baselineRef.current === null) return false;
    return snapshotFields(root) !== baselineRef.current;
  }, [dirty]);

  /** Play the exit, then tell the parent. One close at a time. */
  const leave = useCallback(() => {
    if (!onClose || closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      // Batched with whatever the parent does in `onClose`, so the render
      // below sees both at once.
      onClose();
      setPendingClose(true);
    }, leaveDelay());
  }, [onClose]);

  // The parent's answer to `onClose`, in the same render. Closed: the `open`
  // effect above has already taken the dialog away (or the parent unmounted
  // it). Still open: it refused — a save in flight — so bring the dialog back
  // rather than leave an invisible overlay over the screen.
  useEffect(() => {
    if (!pendingClose) return;
    setPendingClose(false);
    if (open) {
      closingRef.current = false;
      setLeaving(false);
    }
  }, [pendingClose, open]);

  /** The ×, a backdrop click and Escape all come here. */
  const requestClose = useCallback(() => {
    if (!open || !onClose || closingRef.current || confirming) return;
    if (confirmOnDirty && isDirty()) {
      setConfirming(true);
      return;
    }
    leave();
  }, [open, onClose, confirming, confirmOnDirty, isDirty, leave]);

  // The stack: joined while open, left on close or unmount.
  useEffect(() => {
    if (!open) return;
    const id = idRef.current;
    // Below the first entry that is rendered inside this one, else on top.
    const below = openStack.findIndex((e) => e.ancestors.includes(id));
    openStack.splice(below === -1 ? openStack.length : below, 0, { id, ancestors });
    return () => {
      const at = openStack.findIndex((e) => e.id === id);
      if (at >= 0) openStack.splice(at, 1);
    };
    // `ancestors` is fixed for a mounted modal: its place in the tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Only the dialog on top: a confirmation over a form closes alone.
      if (openStack[openStack.length - 1]?.id !== idRef.current) return;
      if (e.key === "Escape") {
        // A field that used Escape itself (a suggestion list closing) says so
        // by preventing the default, and the dialog stays.
        if (e.defaultPrevented) return;
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = wrapperRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // The baseline for "has anything changed", captured on the person's first
  // press or keystroke inside the dialog — before it reaches the field.
  useEffect(() => {
    if (!open || !present) return;
    const root = dialogRef.current;
    if (!root) return;
    const capture = () => {
      if (baselineRef.current === null) baselineRef.current = snapshotFields(root);
    };
    root.addEventListener("pointerdown", capture, true);
    root.addEventListener("mousedown", capture, true);
    root.addEventListener("keydown", capture, true);
    return () => {
      root.removeEventListener("pointerdown", capture, true);
      root.removeEventListener("mousedown", capture, true);
      root.removeEventListener("keydown", capture, true);
    };
  }, [open, present]);

  // Reliable initial focus. React's `autoFocus` is racy inside a portal
  // under Electron: the element can be focused before it is painted, so the
  // OS/renderer drops the focus and the user "can't type" until they click
  // the field. We imperatively focus the first text field ourselves — once
  // synchronously (after the DOM commit) and once on the next frame as a
  // safety net — but only when focus isn't ALREADY inside the dialog, so we
  // never steal focus a form deliberately placed elsewhere and never fight a
  // working autoFocus. Modals with no fields (e.g. ConfirmDialog) are a no-op.
  useEffect(() => {
    if (!open) return;
    const focusFirstField = () => {
      const root = wrapperRef.current;
      if (!root || root.contains(document.activeElement)) return;
      const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea:not([disabled]), select:not([disabled])',
      );
      field?.focus();
    };
    focusFirstField();
    const raf = requestAnimationFrame(focusFirstField);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Lock the page (`.main`) scroll while a modal is open, so the only scrollbar
  // belongs to the modal itself. A module-level counter keeps the lock active
  // until the LAST open modal closes, so stacked modals don't release it early.
  useEffect(() => {
    if (!open) return;
    openModalCount += 1;
    document.body.classList.add("cp-modal-open");
    return () => {
      openModalCount -= 1;
      if (openModalCount <= 0) {
        openModalCount = 0;
        document.body.classList.remove("cp-modal-open");
      }
    };
  }, [open]);

  if (!open && !present) return null;

  // A click "on the backdrop" means it landed on THIS modal's own `.cp-modal`
  // or `.cp-modal-wrapper` — never on the card, and never on a NESTED modal's
  // backdrop, whose React events bubble up through the portal to here and
  // used to close the parent together with the child.
  const isBackdrop = (el: EventTarget | null): boolean =>
    el !== null && (el === backdropRef.current || el === wrapperRef.current);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    downOnBackdropRef.current = isBackdrop(e.target);
  };
  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const wasOnBackdrop = downOnBackdropRef.current && isBackdrop(e.target);
    downOnBackdropRef.current = false;
    if (closeOnBackdrop && wasOnBackdrop) requestClose();
  };

  // Render into <body> via a portal so the overlay is NOT nested inside the
  // route content. That content carries a lasting `transform` (its mount
  // animation uses animation-fill-mode: both, whose final frame is
  // `translateY(0)` — an identity transform that still establishes a
  // containing block). A transformed ancestor makes `position: fixed` resolve
  // against that ancestor instead of the viewport, which clipped the bottom of
  // tall modals. Portaling to body keeps `fixed` truly viewport-relative.
  return createPortal(
    <AncestorsCtx.Provider value={[...ancestors, idRef.current]}>
    <div
      ref={backdropRef}
      className={`cp-modal${leaving ? " cp-modal-leaving" : ""}`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <div ref={wrapperRef} className="cp-modal-wrapper">
        <div ref={dialogRef} className="cp-modal-dialog" role="dialog" aria-modal="true">
          {children}
          {/* Last in the DOM, so a form's first field stays the first stop
              on Tab. Only where the dialog can be closed at all. */}
          {onClose && (
            <button
              type="button"
              className="cp-modal-close"
              aria-label={tActive("action.close")}
              title={tActive("action.close")}
              onClick={requestClose}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {/* The question, as a dialog of its own ON TOP of this one: it joins
          the stack, so its Escape and its backdrop close it alone and this
          dialog — with everything typed into it — stays. */}
      <Modal open={confirming} onClose={() => setConfirming(false)}>
        <div className="card cp-modal-confirm">
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{tActive("modal.leaveConfirm")}</div>
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              {tActive("action.no")}
            </Button>
            <Button type="button" onClick={() => { setConfirming(false); leave(); }}>
              {tActive("action.yes")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </AncestorsCtx.Provider>,
    document.body,
  );
};

export default Modal;
