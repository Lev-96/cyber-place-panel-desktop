import Echo from "laravel-echo";
import Pusher from "pusher-js";

/**
 * Lazy-initialised Echo client wired to the Reverb backend.
 *
 * Reverb implements the Pusher protocol, so we use the official
 * pusher-js client here — no Reverb-specific package needed.
 *
 * Configuration is fully env-driven (`VITE_REVERB_*`). When the key is
 * absent (e.g. local dev without Reverb running) we return `null`,
 * letting callers fall back to REST polling without crashing.
 *
 * Single connection per process — the singleton is cached on
 * `globalThis` so HMR (Vite dev) doesn't churn through sockets.
 */

interface ReverbConfig {
  key: string;
  host: string;
  port: number;
  scheme: "http" | "https";
}

const readConfig = (): ReverbConfig | null => {
  const key = import.meta.env.VITE_REVERB_KEY ?? "";
  const host = import.meta.env.VITE_REVERB_HOST ?? "";
  if (!key || !host) return null;
  const scheme = (import.meta.env.VITE_REVERB_SCHEME ?? "https") as "http" | "https";
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? (scheme === "https" ? 443 : 80));
  return { key, host, port, scheme };
};

type EchoLike = InstanceType<typeof Echo>;

declare global {
  // Cache the Echo instance on globalThis so Vite HMR doesn't open a
  // new WebSocket on every save during development.
  // eslint-disable-next-line no-var
  var __cyberplace_echo__: EchoLike | null | undefined;
}

/**
 * Surface only the failure-state transitions on the Pusher connection
 * underneath Echo. Successful connect/disconnect cycles are silent —
 * they don't help the operator and clutter DevTools. When something
 * is wrong (unavailable / failed / error), we want to see it because
 * "no realtime toast" is otherwise indistinguishable from a silent
 * WebSocket failure.
 */
const attachConnectionFailureWarnings = (echo: EchoLike): void => {
  const pusher = (
    echo as unknown as { connector?: { pusher?: { connection?: { bind?: (e: string, h: (err?: unknown) => void) => void } } } }
  ).connector?.pusher;
  const conn = pusher?.connection;
  if (!conn || typeof conn.bind !== "function") return;
  conn.bind("unavailable", () => console.warn("[reverb] unavailable — backing off"));
  conn.bind("failed", () => console.warn("[reverb] failed — WebSocket unsupported by runtime?"));
  conn.bind("error", (err: unknown) => console.warn("[reverb] connection error", err));
};

const buildEcho = (cfg: ReverbConfig): EchoLike => {
  // pusher-js needs to be exposed as a global for Echo to find — this
  // is the documented integration pattern.
  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

  const echo = new Echo({
    broadcaster: "reverb",
    key: cfg.key,
    wsHost: cfg.host,
    wsPort: cfg.port,
    wssPort: cfg.port,
    forceTLS: cfg.scheme === "https",
    enabledTransports: ["ws", "wss"],
    // Public channels only for now — no auth endpoint configured.
    // When we add private channels later, set authEndpoint here.
  }) as unknown as EchoLike;
  attachConnectionFailureWarnings(echo);
  return echo;
};

/**
 * Returns the shared Echo client, or `null` if Reverb isn't configured.
 * Callers MUST handle the null case (fallback to polling) so missing
 * env vars never crash the app.
 */
export const getEcho = (): EchoLike | null => {
  if (globalThis.__cyberplace_echo__ !== undefined) {
    return globalThis.__cyberplace_echo__;
  }
  const cfg = readConfig();
  if (!cfg) {
    globalThis.__cyberplace_echo__ = null;
    return null;
  }
  globalThis.__cyberplace_echo__ = buildEcho(cfg);
  return globalThis.__cyberplace_echo__;
};
