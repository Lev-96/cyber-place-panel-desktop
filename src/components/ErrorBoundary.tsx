import { crashReport, reloadAtHome } from "@/components/errors/crashReport";
import { tActive } from "@/i18n/translations";
import { desktopAppVersion } from "@/infrastructure/desktopApp";
import { logger } from "@/infrastructure/Logger";
import { Component, ErrorInfo, ReactNode } from "react";

/** What a fallback is given: the report text and a way to try the subtree again. */
export interface CaughtCrash {
  /** The plain-text report for support (never rendered). */
  report: string;
  reset: () => void;
}

interface Props {
  children: ReactNode;
  /**
   * The screen to show instead of the children. Omitted = the root's
   * full-window last resort below.
   */
  fallback?: (crash: CaughtCrash) => ReactNode;
  /**
   * When this changes while a crash is shown, the boundary tries its children
   * again. The route boundary passes the pathname, so choosing another entry
   * in the side menu leaves the crashed screen.
   */
  resetKey?: unknown;
}

interface State {
  error: unknown;
  componentStack: string | null;
  copied: boolean;
}

const CLEAR: State = { error: null, componentStack: null, copied: false };

/**
 * A render error caught before it blanks everything above it.
 *
 * A class because React offers error boundaries only as classes. Used twice:
 * around each screen inside the layout (`RouteErrorBoundary`, menu stays
 * usable), and at the root as the last resort for a crash in the shell itself.
 * Neither puts the error or its stack on the screen: the details go to the
 * clipboard with «Copy for support».
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = CLEAR;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error("Unknown render error") };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    logger.error("Render error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error !== null && prev.resetKey !== this.props.resetKey) this.reset();
  }

  reset = () => this.setState(CLEAR);

  report = (): string => crashReport({
    error: this.state.error,
    componentStack: this.state.componentStack,
    route: typeof window !== "undefined" ? window.location.hash : "",
    at: new Date(),
    version: desktopAppVersion(),
  });

  copyRoot = async () => {
    try {
      await navigator.clipboard.writeText(this.report());
      this.setState({ copied: true });
    } catch { /* clipboard refused: nothing else to offer on the last-resort screen */ }
  };

  render() {
    if (this.state.error === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ report: this.report(), reset: this.reset });
    // Last resort: the shell itself failed, so no router, no layout, no
    // LanguageProvider can be relied on — `tActive` and plain markup only.
    return (
      <div className="cp-crash-root" role="alert">
        <h2 className="cp-crash-root__title">{tActive("errorBoundary.title")}</h2>
        <p className="cp-crash-root__text">{tActive("errorBoundary.description")}</p>
        <div className="cp-crash-root__actions">
          <button type="button" onClick={this.reset} className="btn secondary">{tActive("errorBoundary.tryAgain")}</button>
          <button type="button" onClick={() => void this.copyRoot()} className="btn secondary">
            {tActive(this.state.copied ? "errorBoundary.copied" : "errorBoundary.copy")}
          </button>
          <button type="button" onClick={() => reloadAtHome()} className="btn">{tActive("errorBoundary.reload")}</button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
