import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";

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
 *
 * Private channels (today: `user.{id}.notifications`) authenticate
 * via the `authorizer` below — it POSTs the Sanctum bearer token to
 * the backend's `/broadcasting/auth` endpoint at subscribe time.
 * Public channels (`branch.*`, `company.*`, `bookings.global`,
 * `app-updates*`) bypass the authorizer entirely.
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
/**
 * Pusher protocol codes 4000-4099 mean "do not retry": the server refused this
 * client and reconnecting will not change that. 4001 — "Application does not
 * exist" — is the one that bites in practice: the app key in this build is not
 * the key the Reverb deployment was started with, so every subscription is
 * refused while every screen goes on working off its polling fallback. Said
 * quietly, that is indistinguishable from a quiet evening.
 */
const isFatalProtocolError = (code: number | undefined): boolean =>
  typeof code === "number" && code >= 4000 && code <= 4099;

const errorCodeOf = (err: unknown): number | undefined => {
  const shape = err as { error?: { data?: { code?: unknown } }; data?: { code?: unknown } } | null;
  const code = shape?.error?.data?.code ?? shape?.data?.code;
  return typeof code === "number" ? code : undefined;
};

const attachConnectionFailureWarnings = (echo: EchoLike, cfg: ReverbConfig): void => {
  const pusher = (
    echo as unknown as { connector?: { pusher?: { connection?: { bind?: (e: string, h: (err?: unknown) => void) => void } } } }
  ).connector?.pusher;
  const conn = pusher?.connection;
  if (!conn || typeof conn.bind !== "function") return;

  // One line per distinct failure. pusher-js retries on a backoff, so an
  // unfixable rejection otherwise repeats until it has pushed everything else
  // out of the console.
  const said = new Set<string>();
  const sayOnce = (key: string, message: string) => {
    if (said.has(key)) return;
    said.add(key);
    console.warn(message);
  };

  conn.bind("unavailable", () =>
    sayOnce("unavailable", "[reverb] unavailable — backing off, falling back to polling"),
  );
  conn.bind("failed", () =>
    sayOnce("failed", "[reverb] failed — WebSocket unsupported by runtime?"),
  );
  conn.bind("error", (err: unknown) => {
    const code = errorCodeOf(err);

    if (code === 4001) {
      sayOnce(
        "4001",
        `[reverb] REJECTED: this build's app key "${cfg.key}" does not exist on ${cfg.host}. ` +
          "Realtime is OFF for the whole session — every screen falls back to polling. " +
          "VITE_REVERB_KEY must equal REVERB_APP_KEY on the Reverb service AND on the backend " +
          "that broadcasts to it; all three have to be the same string.",
      );
      return;
    }

    if (isFatalProtocolError(code)) {
      sayOnce(
        `fatal-${code}`,
        `[reverb] REJECTED with protocol code ${code} by ${cfg.host} — retrying will not help. ` +
          "Realtime is OFF; screens fall back to polling.",
      );
      return;
    }

    sayOnce(`error-${code ?? "unknown"}`, `[reverb] connection error ${JSON.stringify(err)}`);
  });
};

/**
 * Per-subscription authorizer. Resolves the bearer token from the
 * shared KV store at subscribe time (not at construction time) so
 * the Echo singleton can be built before the user has logged in —
 * the first private-channel subscription happens AFTER login and
 * the token is in place by then.
 *
 * Failure path: callback(true, ...) returns an Echo error which
 * silently aborts the subscription. The NotificationsContext keeps
 * its 60s polling fallback, so the unread badge eventually catches
 * up even if the auth handshake never succeeds (e.g., token expired,
 * Reverb reachable but backend down).
 */
type AuthCallback = (
  error: Error | null,
  data: { auth: string; channel_data?: string } | null,
) => void;

const buildAuthorizer = () => (channel: { name: string }) => ({
  authorize: (socketId: string, callback: AuthCallback): void => {
    void (async () => {
      try {
        const token = await keyValueStore.get<string>(
          AppConfig.storageKeys.token,
        );
        if (!token) {
          callback(new Error("no token in store"), null);
          return;
        }
        const res = await fetch(
          `${AppConfig.backendUrl}/broadcasting/auth`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channel.name,
            }),
          },
        );
        if (!res.ok) {
          console.warn(
            `[reverb] auth denied for ${channel.name} (HTTP ${res.status})`,
          );
          callback(new Error(`HTTP ${res.status}`), null);
          return;
        }
        const data = (await res.json()) as {
          auth: string;
          channel_data?: string;
        };
        callback(null, data);
      } catch (err) {
        console.warn(`[reverb] auth fetch failed for ${channel.name}`, err);
        callback(err instanceof Error ? err : new Error(String(err)), null);
      }
    })();
  },
});

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
    // Private channels (e.g. `user.{id}.notifications`) authenticate
    // through this dynamic authorizer — see comment above. Public
    // channels never invoke it, so all existing branch/company/global
    // subscriptions are unaffected.
    authorizer: buildAuthorizer(),
  }) as unknown as EchoLike;
  attachConnectionFailureWarnings(echo, cfg);
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
