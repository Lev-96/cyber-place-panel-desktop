import { useEffect, useRef } from "react";
import "@/types/desktopUpdates";
import { apiGetManifest, type AppKind } from "@/api/updates";
import { getEcho } from "./echo";

/**
 * Payload of `App\Events\AppUpdatePromoted` from the backend. Mirrors
 * `broadcastWith()` exactly — any field added on the server has to be
 * added here intentionally so the contract can't drift silently.
 */
export interface AppUpdatePromotedEvent {
  app: "panel" | "agent";
  version: string;
  channel: string;
  mandatory: boolean;
  notes: string | null;
  github_tag: string | null;
  published_at: string | null;
  at: string;
}

/**
 * Subscribe to `.app-update.promoted` on the public `app-updates`
 * channel for the lifetime of the calling component. When the backend
 * promotes a new release, every desktop running this hook receives
 * the event and:
 *
 *   1. Calls the optional `onEvent` callback so the UI can show a
 *      toast / refresh the admin updates screen.
 *   2. Triggers the in-process electron-updater (`window.cyberplaceUpdates`)
 *      if the broadcast targets THIS app. The agent app receives
 *      "panel" events too but ignores them — they're not its concern.
 *
 * Safe to mount in multiple components — Echo de-duplicates channel
 * subscriptions, and the listener cleanup runs on unmount so we never
 * leak a handler.
 *
 * Falls back silently when Reverb isn't configured (`getEcho()` returns
 * null) — a panel that misses the broadcast catches up on next mount via
 * {@link useUpdateCatchUp}, which reads the backend manifest and runs the
 * same gated check.
 */
export const useAppUpdates = (
  thisApp: "panel" | "agent",
  onEvent?: (event: AppUpdatePromotedEvent) => void,
): void => {
  // Stable ref to the callback so the effect doesn't re-subscribe on
  // every render when a parent component re-creates the closure.
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel("app-updates");
    const handler = (event: AppUpdatePromotedEvent) => {
      cbRef.current?.(event);
      // Only drive the local updater when the event names the app we
      // are. We pass the promoted version through the GATED check, so a
      // panel installs exactly the version the admin just promoted and
      // nothing else. Cross-events (e.g. an agent broadcast received in
      // the panel) are handed to the callback but never touch the updater.
      if (event.app === thisApp) {
        window.cyberplaceUpdates
          ?.checkGated(event.version)
          .catch(() => { /* swallowed; main-process logs the error */ });
      }
    };
    channel.listen(".app-update.promoted", handler);

    return () => {
      try {
        channel.stopListening(".app-update.promoted");
        echo.leaveChannel("app-updates");
      } catch { /* echo may be torn down already during HMR */ }
    };
  }, [thisApp]);
};

/**
 * Catch-up for a panel that was offline (or closed) when the admin
 * promoted — the Reverb broadcast in {@link useAppUpdates} only reaches
 * live panels. On mount this reads the backend rollout manifest and, if a
 * version is promoted, runs the SAME gated check, so the promoted (and
 * only the promoted) version installs. The backend pointer stays the
 * single source of truth for what a panel is allowed to install.
 *
 * Mount once near the authed app root — it runs a single manifest read
 * per mount and no-ops when nothing is promoted or the updater bridge is
 * absent (browser/dev).
 */
const CATCH_UP_POLL_MS = 10 * 60 * 1000; // 10 min

export const useUpdateCatchUp = (app: AppKind): void => {
  useEffect(() => {
    let cancelled = false;

    const runOnce = async () => {
      try {
        const manifest = await apiGetManifest(app);
        if (cancelled || !manifest) return;
        await window.cyberplaceUpdates?.checkGated(manifest.version);
      } catch { /* offline / not authed yet — retried on the next tick */ }
    };

    void runOnce();
    // Polling fallback (realtime hard rule #11): the `app-update.promoted`
    // Reverb broadcast is the primary path, but a panel left running for
    // days could miss it on a Reverb blip — a periodic manifest re-check
    // guarantees a promoted version is still picked up. Cheap: one manifest
    // GET, and the gated check only downloads on an exact promoted match.
    const id = setInterval(() => { void runOnce(); }, CATCH_UP_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [app]);
};
