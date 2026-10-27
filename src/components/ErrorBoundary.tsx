import { tActive } from "@/i18n/translations";
import { logger } from "@/infrastructure/Logger";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 32, gap: 16,
        background: "var(--color-bg)", color: "var(--color-text)", textAlign: "center",
      }}>
        <h2 style={{ margin: 0, color: "var(--color-danger)" }}>{tActive("errorBoundary.title")}</h2>
        <pre style={{
          maxWidth: 720, maxHeight: 240, overflow: "auto",
          background: "var(--color-surface)", border: "1px solid #1f2a44", borderRadius: 8,
          padding: 12, color: "var(--color-muted)", fontSize: 12, textAlign: "left",
        }}>
          {this.state.error.message}
          {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
        </pre>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={this.reset} className="btn secondary">{tActive("errorBoundary.tryAgain")}</button>
          <button onClick={this.reload} className="btn">{tActive("errorBoundary.reload")}</button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
