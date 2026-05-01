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

const buildEcho = (cfg: ReverbConfig): EchoLike => {
  // pusher-js needs to be exposed as a global for Echo to find — this
  // is the documented integration pattern.
  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

  return new Echo({
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
