import { ComponentType, LazyExoticComponent, Suspense, lazy } from "react";
import type { StateVariant } from "./variants";

/**
 * One pose per variant, each its own chunk: the main bundle carries none of
 * them, and a screen downloads only the pose it shows. Until the chunk lands
 * the frame keeps its size (no layout jump).
 */
const POSES: Record<StateVariant, LazyExoticComponent<ComponentType>> = {
  empty: lazy(() => import("./poses/EmptyPose")),
  noResults: lazy(() => import("./poses/NoResultsPose")),
  notFound: lazy(() => import("./poses/NotFoundPose")),
  error: lazy(() => import("./poses/ErrorPose")),
  offline: lazy(() => import("./poses/OfflinePose")),
  success: lazy(() => import("./poses/SuccessPose")),
};

const GamerIllustration = ({ variant }: { variant: StateVariant }) => {
  const Pose = POSES[variant];
  return (
    <div className="cp-state__art" aria-hidden="true" data-pose={variant}>
      <Suspense fallback={null}>
        <Pose />
      </Suspense>
    </div>
  );
};

export default GamerIllustration;
