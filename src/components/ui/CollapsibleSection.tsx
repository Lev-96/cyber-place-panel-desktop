import { DragEvent, ReactNode } from "react";

interface Props {
  title: string;
  /** Optional count badge (e.g. number of tiles in the section). */
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** When true a drag grip is shown and the section can be reordered. */
  reorderable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  /** This section is currently being dragged. */
  dragging?: boolean;
  /** The drop will land just before this section. */
  dropTarget?: boolean;
  dragHint?: string;
}

/**
 * A titled, collapsible section with a smooth height animation, an optional
 * count badge and optional drag-to-reorder handle. Single source of truth for
 * the "grouped board" look — reuse it for the sessions board, the places grid,
 * the live screen, etc. rather than hand-rolling headers per screen. DnD state
 * and persistence stay with the parent (see useLocalReorder); this component
 * only renders and forwards the drag events.
 */
const CollapsibleSection = ({
  title,
  count,
  open,
  onToggle,
  children,
  reorderable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragging,
  dropTarget,
  dragHint,
}: Props) => (
  <section
    className={`cp-section${dragging ? " is-dragging" : ""}${dropTarget ? " is-drop-before" : ""}`}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <div className="cp-section-head">
      <button type="button" className="cp-section-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="cp-section-chev" data-open={open ? "true" : "false"} aria-hidden>▸</span>
        <span className="cp-section-title">{title}</span>
        {count != null && <span className="cp-section-count">{count}</span>}
      </button>
      {reorderable && (
        <span
          className="cp-section-grip"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title={dragHint}
          aria-label={dragHint}
        >
          ⠿
        </span>
      )}
    </div>
    <div className="cp-section-body" data-open={open ? "true" : "false"}>
      <div className="cp-section-inner">{children}</div>
    </div>
  </section>
);

export default CollapsibleSection;
