import { useEffect, useRef } from "react";
import "@/types/desktopUpdates";
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
 * null) — the on-boot `check()` in the main process still discovers
 * the update on next start.
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
      // Only ask electron-updater to check when the event names the
      // app we are. Otherwise (e.g. agent broadcast received in
      // panel) it's a benign cross-event; pass it through to the
      // callback but don't touch the local updater.
      if (event.app === thisApp) {
        window.cyberplaceUpdates
          ?.check()
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
