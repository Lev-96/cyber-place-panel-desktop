import { ReactNode } from "react";
import ErrorState, { ErrorStateProps } from "./ErrorState";
import StaleNotice from "./StaleNotice";
import StateView, { StateViewProps, StateViewSize } from "./StateView";
import { ViewState } from "./viewState";

type Copy = Omit<StateViewProps, "variant" | "size">;

export interface StateSwitchProps {
  view: ViewState;
  /** The screen's own skeleton — loading is never the illustration. */
  skeleton: ReactNode;
  /** Copy (and CTA) for "there is genuinely nothing". */
  empty?: Copy;
  /** Copy for "the search / filter matched nothing". */
  noResults?: Copy;
  /** Copy for a failed read, a 404, and what a 404 offers. */
  error?: Omit<ErrorStateProps, "error" | "onRetry" | "size">;
  onRetry?: () => void;
  size?: StateViewSize;
  /** The data, rendered only in the `ready` state. */
  children: ReactNode;
}

/**
 * Renders exactly one of: skeleton, error (offline / not found / failed, with
 * Retry), empty, no results, or the data — in the order `deriveViewState`
 * decided. Data kept after a failed refresh gets a one-line notice above it.
 */
const StateSwitch = ({ view, skeleton, empty, noResults, error, onRetry, size = "page", children }: StateSwitchProps) => {
  switch (view.kind) {
    case "loading":
      return <>{skeleton}</>;
    case "error":
      return <ErrorState error={view.error} onRetry={onRetry} size={size} {...error} />;
    case "empty":
      return <StateView variant="empty" size={size} {...empty} />;
    case "noResults":
      return <StateView variant="noResults" size={size} {...noResults} />;
    case "ready":
      return (
        <>
          {view.staleError ? <StaleNotice error={view.staleError} onRetry={onRetry} /> : null}
          {children}
        </>
      );
  }
};

export default StateSwitch;
