import { CSSProperties } from "react";

/**
 * Shimmer skeleton primitive + ready-made list / grid variants used as the
 * loading state for data screens. Pure presentation — no data, no effects —
 * so it can drop in anywhere a Spinner used to be without behavioural risk.
 */

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}

export const Skeleton = ({ width = "100%", height = 12, radius = 8, style }: SkeletonProps) => (
  <span
    className="cp-skeleton"
    style={{ width, height, borderRadius: radius, ...style }}
    aria-hidden
  />
);

/** N placeholder rows shaped like `.list-item` (avatar + two text lines + pill). */
export const ListSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="list" aria-busy="true" aria-label="loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="list-item" style={{ cursor: "default" }}>
        <div className="row" style={{ gap: 12, flex: 1, alignItems: "center" }}>
          <Skeleton width={44} height={44} radius={10} />
          <div className="col" style={{ gap: 9, flex: 1 }}>
            <Skeleton width="45%" height={13} />
            <Skeleton width="70%" height={11} />
          </div>
        </div>
        <Skeleton width={64} height={22} radius={999} />
      </div>
    ))}
  </div>
);

/** Placeholder cells shaped like the places/live grid tiles. */
export const GridSkeleton = ({ cells = 8 }: { cells?: number }) => (
  <div className="live-grid" aria-busy="true" aria-label="loading">
    {Array.from({ length: cells }).map((_, i) => (
      <div key={i} className="place-cell" style={{ minHeight: 130, cursor: "default" }}>
        <Skeleton width="55%" height={11} />
        <Skeleton width="40%" height={20} radius={6} />
        <Skeleton width="50%" height={11} />
        <Skeleton width="70%" height={26} radius={8} style={{ marginTop: 8 }} />
      </div>
    ))}
  </div>
);

/** A paragraph of placeholder lines, last one short like real text. */
export const SkeletonText = ({ lines = 3, width = "100%" }: { lines?: number; width?: number | string }) => (
  <div className="col" style={{ gap: 8, width }} aria-busy="true" aria-label="loading">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} width={i === lines - 1 ? "55%" : "100%"} height={11} />
    ))}
  </div>
);

export const SkeletonAvatar = ({ size = 44 }: { size?: number }) => (
  <Skeleton width={size} height={size} radius="50%" />
);

/**
 * One card: a title, a couple of lines, and a footer control.
 *
 * Sized from the props rather than fixed, so a caller can match the card it is
 * standing in for — a skeleton that is the wrong shape moves the layout twice
 * (once to show it, once to replace it), which is worse than no skeleton.
 */
export const SkeletonCard = ({ lines = 2, height }: { lines?: number; height?: number }) => (
  <div className="card col" style={{ gap: 10, minHeight: height }} aria-busy="true" aria-label="loading">
    <Skeleton width="45%" height={14} />
    <SkeletonText lines={lines} />
    <Skeleton width={110} height={30} radius={8} style={{ marginTop: 4 }} />
  </div>
);

/** A header row and N body rows, in the proportions of a real table. */
export const SkeletonTable = ({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) => (
  <div className="col" style={{ gap: 8 }} aria-busy="true" aria-label="loading">
    <div className="row" style={{ gap: 12 }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width={`${100 / columns}%`} height={12} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="row" style={{ gap: 12, padding: "10px 0", borderTop: "1px solid #1f2a44" }}>
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} width={`${100 / columns}%`} height={11} />
        ))}
      </div>
    ))}
  </div>
);

/** A labelled field, for a form that is still fetching what it edits. */
export const SkeletonInput = ({ label = true }: { label?: boolean }) => (
  <div className="col" style={{ gap: 6 }}>
    {label && <Skeleton width={90} height={10} />}
    <Skeleton width="100%" height={38} radius={10} />
  </div>
);

export const SkeletonForm = ({ fields = 4 }: { fields?: number }) => (
  <div className="col" style={{ gap: 14 }} aria-busy="true" aria-label="loading">
    {Array.from({ length: fields }).map((_, i) => <SkeletonInput key={i} />)}
    <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
      <Skeleton width={100} height={34} radius={8} />
      <Skeleton width={120} height={34} radius={8} />
    </div>
  </div>
);

/** Number-over-label tiles, the shape of every statistics strip here. */
export const SkeletonStats = ({ tiles = 4 }: { tiles?: number }) => (
  <div className="row" style={{ gap: 12, flexWrap: "wrap" }} aria-busy="true" aria-label="loading">
    {Array.from({ length: tiles }).map((_, i) => (
      <div key={i} className="card col" style={{ gap: 10, flex: "1 1 160px", minWidth: 150 }}>
        <Skeleton width="60%" height={10} />
        <Skeleton width="40%" height={24} radius={6} />
      </div>
    ))}
  </div>
);

/**
 * A chat thread mid-load: bubbles alternating sides, in bubble proportions.
 *
 * Deliberately not a centred spinner — a thread that is about to appear should
 * look like a thread, so the eye is already in the right place when it does.
 */
export const SkeletonMessages = ({ bubbles = 4 }: { bubbles?: number }) => (
  <div className="col" style={{ gap: 10 }} aria-busy="true" aria-label="loading">
    {Array.from({ length: bubbles }).map((_, i) => (
      <div
        key={i}
        style={{
          alignSelf: i % 2 === 0 ? "flex-start" : "flex-end",
          width: `${55 + ((i * 13) % 25)}%`,
          border: "1px solid #1f2a44",
          borderRadius: i % 2 === 0 ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        <Skeleton width="35%" height={9} />
        <Skeleton width="90%" height={11} />
        {i % 2 === 0 && <Skeleton width="60%" height={11} />}
      </div>
    ))}
  </div>
);

/**
 * The stand-in for a whole route while its code is still downloading.
 *
 * A title, a strip of tiles and a list — the shape almost every screen here
 * takes. It is replaced within a frame or two by the screen's OWN skeleton, so
 * its job is only to stop the window going blank between them.
 */
export const RouteSkeleton = () => (
  <div className="col" style={{ gap: 18, padding: 4 }} aria-busy="true" aria-label="loading">
    <Skeleton width={220} height={26} radius={8} />
    <SkeletonStats tiles={3} />
    <ListSkeleton rows={4} />
  </div>
);

export default Skeleton;
