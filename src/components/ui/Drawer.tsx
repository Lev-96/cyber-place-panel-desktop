import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The id of the panel's heading (its accessible name). */
  labelledBy: string;
  children: ReactNode;
}

/**
 * A panel that slides in from the right (2026-11-09, the platform bill's
 * «Details»). The page stays visible on the left; Escape, the dimmed page or
 * the panel's own close button shut it. The slide is a transform, skipped
 * entirely for people who ask the system for reduced motion (CSS).
 */
const Drawer = ({ open, onClose, labelledBy, children }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    // One frame in the closed position first, so the slide actually plays.
    const frame = requestAnimationFrame(() => setShown(true));
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={`cp-drawer${shown ? " is-open" : ""}`}>
      <div className="cp-drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="cp-drawer__panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Drawer;
