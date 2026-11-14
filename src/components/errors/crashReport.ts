/**
 * What a crash screen hands to support, and how the last-resort screen leaves.
 *
 * The details are for a person debugging, not for the cashier who hit the
 * error: they go to the clipboard («Copy for support»), never onto the screen.
 * Nothing here reads a token or the account; the route is the hash only.
 */

export interface CrashDetails {
  /** Whatever was thrown: usually an Error, but a render can throw anything. */
  error: unknown;
  /** React's component stack from `componentDidCatch`, when there is one. */
  componentStack: string | null | undefined;
  /** The screen's address (`location.hash`). */
  route: string;
  at: Date;
  /** The desktop build's version; null on the web. */
  version: string | null;
}

/** Plain text, one fact per line, pasted as-is into a support message. */
export const crashReport = ({ error, componentStack, route, at, version }: CrashDetails): string => {
  const isError = error instanceof Error;
  const lines = [
    "Cyber Place panel: a screen failed to render",
    `Time: ${at.toISOString()}`,
    `Route: ${route || "#/"}`,
    `Version: ${version ?? "web"}`,
    `Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "-"}`,
    `Error: ${isError ? `${error.name}: ${error.message}` : String(error)}`,
  ];
  if (isError && error.stack) lines.push("", "Stack:", error.stack);
  if (componentStack) lines.push("", "Components:", componentStack.trim());
  return lines.join("\n");
};

/** The two parts of `window` a reload needs; a stand-in in tests. */
export interface ReloadTarget {
  location: { href: string; reload: () => void };
  history: { replaceState: (data: unknown, unused: string, url: string) => void };
}

/**
 * Reload onto the home screen, not onto the screen that crashed.
 *
 * A plain reload brings back the same `#/route` and with it the same crash,
 * and the Electron window has no address bar to type another. A hash-only
 * `location.replace` would be a same-document navigation (no reload), so the
 * address is rewritten in place first and then reloaded.
 */
export const reloadAtHome = (win: ReloadTarget = window): void => {
  const url = new URL(win.location.href);
  url.hash = "#/";
  win.history.replaceState(null, "", url.toString());
  win.location.reload();
};
