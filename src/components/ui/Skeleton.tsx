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

export default Skeleton;
