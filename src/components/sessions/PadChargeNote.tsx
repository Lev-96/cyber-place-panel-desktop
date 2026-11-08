import { useAnchoredPopover } from "@/hooks/useAnchoredPopover";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * What a pad press did to the seat, said for a moment beside its card
 * (owner, 2026-11-04): "3/4 · 12 ֏", "Rate now: 2,300 ֏/h". It used to be a
 * line on the card itself, which made the card taller the moment a pad went
 * out and every card beside it with it.
 *
 * Two parts, neither of which touches the card's layout:
 *  - an empty anchor laid over the whole card (`position: absolute`, out of
 *    the flow of the card's grid or flex), only there while the note is;
 *  - the note itself in a portal on `document.body`, placed by the app's
 *    `useAnchoredPopover` — above the card when there is room, below when not,
 *    inside the window, following a scroll — so no section's `overflow` clips
 *    it and the board's zoom does not shrink it.
 *
 * Orange (the warning tone), not clickable (`pointer-events: none`), and
 * announced politely to assistive tech. How long it stays is the caller's
 * (`useTransientFlags`).
 */
const NOTE_WIDTH = 240;

interface Props {
  /** The lines to say; nothing is drawn without one. */
  lines: ReadonlyArray<ReactNode>;
  testId?: string;
}

const PadChargeNote = ({ lines, testId }: Props) => {
  const anchor = useRef<HTMLSpanElement>(null);
  const pos = useAnchoredPopover(anchor, lines.length > 0, NOTE_WIDTH);
  if (lines.length === 0) return null;
  return (
    <>
      <span ref={anchor} className="pad-note-anchor" aria-hidden />
      {pos && createPortal(
        <div className="pad-note" role="status" aria-live="polite" style={{ ...pos.style, maxWidth: NOTE_WIDTH }} data-testid={testId}>
          {lines.map((line, i) => <div key={i} className="pad-note__line">{line}</div>)}
        </div>,
        document.body,
      )}
    </>
  );
};

export default PadChargeNote;
