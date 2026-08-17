/**
 * Which URLs the main process is willing to act on.
 *
 * Both decisions used to be implicit and permissive:
 *
 *  - `setWindowOpenHandler` passed whatever the renderer asked for straight to
 *    `shell.openExternal`, so the OS acted on ANY scheme — `file://`,
 *    `smb://`, and on Windows handler URIs like `ms-msdt:` / `search-ms:`.
 *    The URLs reaching it are not even renderer-authored: PulseDashboardCard
 *    opens `link.url` from `POST /admin/pulse/access`, and Metrics opens
 *    `data.dashboard_url` from the Metrika summary — both server-supplied.
 *
 *  - There was no `will-navigate` handler at all, so the renderer could
 *    navigate the top-level frame off `app://localhost` and the preload —
 *    with `kv:get`, which returns the Sanctum token — would follow it there.
 *
 * Kept as pure functions so they are unit-testable without Electron.
 */

/** Loopback hosts where plain HTTP is a developer's local backend, not a risk. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * True only for URLs safe to hand to the operating system.
 *
 * HTTPS always; plain HTTP only against loopback, because a local backend
 * legitimately serves the Pulse entry link over `http://localhost:8000`.
 * Everything else — including `file:`, `javascript:` and OS handler schemes —
 * is refused.
 */
export const mayOpenExternally = (raw: string): boolean => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOCAL_HOSTS.has(url.hostname);

  return false;
};

/**
 * True only for URLs the top-level frame may navigate to.
 *
 * Compares `protocol//host` rather than `origin`: Chromium treats the
 * privileged `app:` scheme as standard and gives it a real origin, but Node's
 * URL parser reports `"null"` for it, so an origin comparison would behave
 * differently in tests than at runtime.
 */
export const mayNavigateTo = (raw: string, allowed: readonly string[]): boolean => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  return allowed.includes(`${url.protocol}//${url.host}`);
};

/** Normalises a URL to the `protocol//host` key `mayNavigateTo` compares against. */
export const navigationKeyFor = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};
