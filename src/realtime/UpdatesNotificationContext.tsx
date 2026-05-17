import { useAuth } from "@/auth/AuthContext";
import { apiAgentUpdateStatus } from "@/api/agent-updates";
import { apiCheckUpdates, type UpdateCheckEntry } from "@/api/updates";
import { useAppUpdates } from "@/realtime/useAppUpdates";
import { getEcho } from "@/realtime/echo";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Single source of truth for "is there a new release on GitHub that
 * hasn't been promoted yet?" — feeds the global update-available
 * toast AND the red sidebar badge AND (eventually) the updates
 * screens themselves so we only hit the backend once per cycle.
 *
 * Role-aware endpoint selection:
 *   - admin               → /admin/updates/check  (panel + agent)
 *   - company_owner / mgr → /agent-updates/status (agent only — they
 *                            can't promote panel releases anyway)
 *
 * Discovery cascade (server-side):
 *   The backend ReleaseWatcher polls GitHub every 30s and, when it
 *   finds a brand-new version, fires `.app-release.available` on the
 *   role-specific channel `app-updates.{role}`:
 *     1. admin         — immediately
 *     2. company_owner — +5s (only for agent releases)
 *     3. manager       — +10s (only for agent releases)
 *   We subscribe to ONLY our role's channel so admin learns first,
 *   owner next, manager last — no fan-out duplicates.
 *
 * Refresh triggers in priority order:
 *   1. Initial fetch on mount — freshly-logged-in user sees badge
 *      immediately without waiting for the next poll/broadcast.
 *   2. Role-channel broadcast — primary path now that the watcher
 *      pushes new versions in real time.
 *   3. `.app-update.promoted` broadcast — fired by promote(), used
 *      to clear the badge across the fleet after an admin acts.
 *   4. Window focus / visibility — cheap one-shot reload when the
 *      user returns to the app.
 *   5. 5-minute backstop poll — survives transient WebSocket drops
 *      without spamming the backend (was 60s; broadcast is now the
 *      fast path).
 */

const POLL_INTERVAL_MS = 5 * 60_000;

interface UpdatesNotificationState {
  /** null when this role has no panel-update visibility (owner/manager). */
  panel: UpdateCheckEntry | null;
  agent: UpdateCheckEntry | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<UpdatesNotificationState>({
  panel: null,
  agent: null,
  reload: async () => { /* noop */ },
});

/**
 * Map the user role to the Reverb channel the watcher cascade
 * broadcasts on. Returning null means "this role doesn't get the
 * realtime channel" — we still rely on REST reload for those.
 */
const channelForRole = (role: string | undefined): string | null => {
  if (role === "admin") return "app-updates.admin";
  if (role === "company_owner") return "app-updates.company_owner";
  if (role === "manager") return "app-updates.manager";
  return null;
};

export const UpdatesNotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const role = user?.role;

  const [panel, setPanel] = useState<UpdateCheckEntry | null>(null);
  const [agent, setAgent] = useState<UpdateCheckEntry | null>(null);

  const reload = useCallback(async () => {
    if (!role) return;
    try {
      if (role === "admin") {
        const data = await apiCheckUpdates();
        setPanel(data.panel);
        setAgent(data.agent);
      } else if (role === "company_owner" || role === "manager") {
        const data = await apiAgentUpdateStatus();
        setPanel(null);
        setAgent(data);
      }
    } catch {
      // Silent fail at the badge/toast layer — the dedicated updates
      // pages still surface errors when the user navigates to them.
    }
  }, [role]);

  useEffect(() => {
    if (!role) return;
    void reload();
    const id = setInterval(() => { void reload(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [role, reload]);

  // Window focus → immediate reload. Chromium throttles setInterval
  // when the window is in the background (5+ minute intervals can
  // become longer), so a fresh GitHub release published while the user
  // was away might not surface until the next natural tick. Hitting
  // reload on focus closes that gap to "as fast as the user can
  // refocus the window".
  useEffect(() => {
    if (!role) return;
    const onFocus = () => { void reload(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
      // visibilitychange listener is anonymous; safe to leak in
      // electron renderer (one per mount, mount is per-session).
    };
  }, [role, reload]);

  // Role-specific watcher cascade. Admin gets it first; owner +5s
  // (agent only); manager +10s (agent only). We don't need to inspect
  // the event payload — any signal on our channel means "new version
  // exists, refresh state so badge + toast surface it".
  useEffect(() => {
    const channelName = channelForRole(role);
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(channelName);
    const handler = () => { void reload(); };
    channel.listen(".app-release.available", handler);

    return () => {
      try {
        channel.stopListening(".app-release.available");
        echo.leaveChannel(channelName);
      } catch { /* echo may be torn down already during HMR */ }
    };
  }, [role, reload]);

  // Promote broadcast (admin clicked Apply somewhere in the fleet):
  // re-sync so the "available" badge clears once the pointer moves.
  // Pass "panel" as thisApp so the hook's auto-`check()` only fires
  // for panel events — we just want the side-effect of re-fetching.
  useAppUpdates("panel", () => { void reload(); });

  return (
    <Ctx.Provider value={{ panel, agent, reload }}>
      {children}
    </Ctx.Provider>
  );
};

export const useUpdatesNotification = (): UpdatesNotificationState =>
  useContext(Ctx);
