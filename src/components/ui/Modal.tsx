import { ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  onClose?: () => void;
  /** When true, clicking backdrop closes the modal. Default true. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Centered modal overlay. The outer `.cp-modal` is the scroll container.
 * The inner `.cp-modal-wrapper` enforces `min-height: 100%` so:
 *   - content shorter than viewport → centered vertically
 *   - content taller than viewport → wrapper grows, .cp-modal scrolls and
 *     the title is always reachable from the top.
 */
const Modal = ({ open, onClose, closeOnBackdrop = true, children }: Props) => {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && onClose && e.target === e.currentTarget) onClose();
  };

  return (
    <div className="cp-modal" onClick={onBackdropClick}>
      <div className="cp-modal-wrapper" onClick={onBackdropClick}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
