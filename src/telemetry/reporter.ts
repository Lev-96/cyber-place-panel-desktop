import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import type { TelemetryEvent, TelemetryLevel } from "@/api/telemetry";

/**
 * Fire-and-forget telemetry reporter.
 *
 * Feeds the admin panel's "Мониторинг · Десктоп-панель" section. The contract
 * it holds itself to, in order of importance:
 *
 *  1. **It can never break the app it reports on.** Every path is wrapped;
 *     a failed flush is dropped, never retried into a storm and never
 *     surfaced. Telemetry that can take down the product is worse than no
 *     telemetry.
 *  2. **It is bounded.** The queue has a hard cap and drops the OLDEST events
 *     when full, so a client that has been offline for a day cannot grow its
 *     memory until it dies — and when it reconnects it sends what is recent
 *     and therefore still relevant.
 *  3. **It is anonymous.** The only identifier is a random install id this
 *     module generates and stores locally. No device fingerprint, no user
 *     data; the backend attaches the staff user itself when a request happens
 *     to carry a token.
 */

const STORAGE_KEY = "telemetry.install_id";
const FLUSH_INTERVAL_MS = 20_000;
const MAX_QUEUE = 100;
const MAX_BATCH = 25;

let queue: TelemetryEvent[] = [];
let installId: string | null = null;
let started = false;

const platform = (): string => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Windows/i.test(ua)) return "win32";
  if (/Mac OS/i.test(ua)) return "darwin";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
};

const version = (): string => {
  try {
    return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
  } catch {
    return "dev";
  }
};

/**
 * A random, non-identifying id for this installation, minted once and kept.
 * `crypto.randomUUID` is present in Electron 33; the fallback exists so a
 * missing crypto can never be the thing that throws during boot.
 */
const ensureInstallId = async (): Promise<string> => {
  if (installId) return installId;

  try {
    const stored = await keyValueStore.get<string>(STORAGE_KEY);
    if (typeof stored === "string" && stored.length > 0) {
      installId = stored;
      return stored;
    }
  } catch { /* fall through to minting a new one */ }

  const minted =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  installId = minted;
  try { await keyValueStore.set(STORAGE_KEY, minted); } catch { /* memory-only this run */ }

  return minted;
};

/** Queue one event. Never awaits, never throws. */
export const track = (
  event: string,
  options: { name?: string; level?: TelemetryLevel; payload?: Record<string, unknown> } = {},
): void => {
  try {
    queue.push({
      event,
      name: options.name,
      level: options.level ?? "info",
      app_version: version(),
      platform: platform(),
      occurred_at: new Date().toISOString(),
      payload: options.payload,
    });

    // Drop from the FRONT: when a client has been queueing for a long time,
    // the recent events are the ones still worth sending.
    if (queue.length > MAX_QUEUE) {
      queue = queue.slice(queue.length - MAX_QUEUE);
    }
  } catch { /* telemetry must never throw into a caller */ }
};

export const trackError = (name: string, message: string, payload: Record<string, unknown> = {}): void => {
  track("error", { name, level: "error", payload: { message: message.slice(0, 500), ...payload } });
};

/**
 * Send whatever is queued.
 *
 * Uses a bare fetch rather than the api client on purpose: this must not run
 * through the response cache or the auth-error paths, and a monitoring call
 * must never be able to trip the app's own error handling.
 */
export const flush = async (): Promise<void> => {
  if (queue.length === 0) return;

  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);

  try {
    const id = await ensureInstallId();

    await fetch(`${AppConfig.backendUrl}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        app: "panel",
        events: batch.map((e) => ({ ...e, install_id: id })),
      }),
      keepalive: true,
    });
  } catch {
    // Dropped on purpose. Re-queuing would mean an unreachable backend
    // produces an ever-growing queue and a retry storm the moment it returns.
  }
};

/**
 * Start reporting. Idempotent — a second call is a no-op, so React StrictMode
 * double-invoking an effect cannot double-instrument the app.
 */
export const startTelemetry = (): void => {
  if (started) return;
  started = true;

  track("app.launch");

  const timer = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
  (timer as unknown as { unref?: () => void }).unref?.();

  if (typeof window !== "undefined") {
    // Last chance to ship what is queued. `keepalive` on the fetch is what
    // lets it survive the window going away.
    window.addEventListener("beforeunload", () => { void flush(); });

    window.addEventListener("error", (e) => {
      trackError(e.error?.name ?? "Error", e.message ?? "unknown", {
        source: e.filename ?? undefined,
        line: e.lineno ?? undefined,
      });
    });

    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason as { name?: string; message?: string } | undefined;
      trackError(reason?.name ?? "UnhandledRejection", reason?.message ?? String(e.reason ?? "unknown"));
    });
  }
};

/** Test seam: forget everything this module is holding. */
export const __resetTelemetry = (): void => {
  queue = [];
  installId = null;
  started = false;
};

/** Test seam: what is waiting to be sent. */
export const __queue = (): readonly TelemetryEvent[] => queue;
