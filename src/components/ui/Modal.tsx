import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose?: () => void;
  /** When true, clicking backdrop closes the modal. Default true. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/** How many modals are currently open — drives the body scroll-lock so stacked
 *  modals release the lock only when the last one closes. */
let openModalCount = 0;

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
 */
const Modal = ({ open, onClose, closeOnBackdrop = true, children }: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const downOnBackdropRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
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
  }, [open, onClose]);

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

  if (!open) return null;

  // A click "on the backdrop" means it landed on .cp-modal or its
  // direct .cp-modal-wrapper child, never on the card content. The
  // handler is attached only to the outermost element so React events
  // don't bubble through both .cp-modal and .cp-modal-wrapper and
  // overwrite the ref midway.
  const isBackdrop = (el: EventTarget | null): boolean => {
    if (!(el instanceof Element)) return false;
    return el.classList.contains("cp-modal") || el.classList.contains("cp-modal-wrapper");
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    downOnBackdropRef.current = isBackdrop(e.target);
  };
  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const wasOnBackdrop = downOnBackdropRef.current && isBackdrop(e.target);
    downOnBackdropRef.current = false;
    if (closeOnBackdrop && onClose && wasOnBackdrop) onClose();
  };

  // Render into <body> via a portal so the overlay is NOT nested inside the
  // route content. That content carries a lasting `transform` (its mount
  // animation uses animation-fill-mode: both, whose final frame is
  // `translateY(0)` — an identity transform that still establishes a
  // containing block). A transformed ancestor makes `position: fixed` resolve
  // against that ancestor instead of the viewport, which clipped the bottom of
  // tall modals. Portaling to body keeps `fixed` truly viewport-relative.
  return createPortal(
    <div className="cp-modal" onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      <div ref={wrapperRef} className="cp-modal-wrapper">
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
