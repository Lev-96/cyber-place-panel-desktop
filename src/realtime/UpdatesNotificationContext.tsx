import { useAuth } from "@/auth/AuthContext";
import { useRealtimeVersion } from "@/realtime/useRealtimeVersion";
import { apiAgentUpdateStatus, type AgentUpdateStatus } from "@/api/agent-updates";
import { apiCheckUpdates, type UpdateCheckEntry } from "@/api/updates";
import { useAppUpdates } from "@/realtime/useAppUpdates";
import { getEcho } from "@/realtime/echo";
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Single source of truth for "is there an update this person should act
 * on?" — feeds the global update-available toast AND the red sidebar badge
 * (`updateBadges.ts`), so the backend is asked once per cycle.
 *
 * Role-aware endpoint selection:
 *   - admin               → /admin/updates/check  (panel + agent: GitHub's
 *                            latest against the promoted version)
 *   - company_owner / mgr → /agent-updates/status (agent only — they
 *                            can't promote panel releases anyway), kept
 *                            exactly as the server sent it (`agentRollout`):
 *                            which of their branches still has connected
 *                            computers to update, and how many branches
 *                            that is (2026-11-17). Nothing is recomputed here.
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
 *   4. `reload()` from the agent updates screen right after an apply, so
 *      the badge clears at once instead of on the next tick.
 *   5. Window focus / visibility — cheap one-shot reload when the
 *      user returns to the app.
 *   6. 60-second backstop poll — kept tight because the cascade
 *      broadcast is best-effort (Reverb has no message persistence;
 *      a transient connection drop loses that event entirely). 60s
 *      means worst-case the toast is one minute late instead of
 *      "until the user navigates away and back."
 */

const POLL_INTERVAL_MS = 60_000;

export interface UpdatesNotificationState {
  /** Admin only (GitHub's latest vs the promoted version); null for everyone else. */
  panel: UpdateCheckEntry | null;
  agent: UpdateCheckEntry | null;
  /** Owner / manager only: the agent rollout per branch, exactly as the server sent it. */
  agentRollout: AgentUpdateStatus | null;
  /** Ask again now: after an apply, so the badge clears without waiting for the poll. */
  reload: () => Promise<void>;
}

const Ctx = createContext<UpdatesNotificationState>({
  panel: null,
  agent: null,
  agentRollout: null,
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
  const userId = user?.id ?? null;

  const [panel, setPanel] = useState<UpdateCheckEntry | null>(null);
  const [agent, setAgent] = useState<UpdateCheckEntry | null>(null);
  const [agentRollout, setAgentRollout] = useState<AgentUpdateStatus | null>(null);

  // WHO the state describes. An account switch keeps this provider mounted
  // (the user changes, never to null), and the owner's answer names branches
  // by address: the next account is never shown the previous one's — it is
  // forgotten at the switch, and an answer the previous account asked for that
  // lands afterwards is dropped.
  const identityRef = useRef(userId);
  identityRef.current = userId;
  useEffect(() => {
    setPanel(null);
    setAgent(null);
    setAgentRollout(null);
  }, [userId]);

  const reload = useCallback(async () => {
    if (!role) return;
    const askedFor = identityRef.current;
    try {
      if (role === "admin") {
        const data = await apiCheckUpdates();
        if (identityRef.current !== askedFor) return;
        setPanel(data.panel);
        setAgent(data.agent);
        setAgentRollout(null);
      } else if (role === "company_owner" || role === "manager") {
        const data = await apiAgentUpdateStatus();
        if (identityRef.current !== askedFor) return;
        setPanel(null);
        setAgent(null);
        // As sent. Owner/manager hear only about an admin-APPROVED version that
        // one of THEIR branches still needs, and only the server knows that:
        // which computers are connected, which were already sent the version
        // (by anybody), which branch is blocked. Until 2026-11-17 this was
        // worked out here from `applied_version`, a per-PERSON record, so a
        // manager who joined after the owner had applied was told to apply again.
        setAgentRollout(data);
      }
    } catch {
      // Silent fail at the badge/toast layer — the dedicated updates
      // pages still surface errors when the user navigates to them.
    }
  }, [role]);

  // `userId` too: another account of the same role asks again at once.
  useEffect(() => {
    if (!role) return;
    void reload();
    const id = setInterval(() => { void reload(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [role, userId, reload]);

  // Window focus → immediate reload. Chromium throttles setInterval
  // when the window is in the background (5+ minute intervals can
  // become longer), so a version approved while the user was away
  // might not surface until the next natural tick. Hitting reload on
  // focus closes that gap to "as fast as the user can refocus the window".
  //
  // Both listeners are NAMED and both are removed. The visibility one used to
  // be an anonymous arrow nothing ever removed: every role change (an account
  // switch) and every remount left one more behind, each still calling the
  // reload of a provider that was gone.
  useEffect(() => {
    if (!role) return;
    const onFocus = () => { void reload(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [role, reload]);

  // Role-specific watcher cascade. Admin gets it first; owner +5s
  // (agent only); manager +10s (agent only). We don't need to inspect
  // the event payload — any signal on our channel means "new version
  // exists, refresh state so badge + toast surface it".
  // Re-attaches when the Echo client is rebuilt on connection details the
  // backend handed us: a subscription on the discarded client is silent.
  const realtime = useRealtimeVersion();

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
        // Realtime rule 9 (CLAUDE.md §6): name the listener and never leave
        // the channel. Echo caches a channel object without refcounting, so
        // `leaveChannel` here deafened any other subscriber of
        // `app-updates.{role}`, and `stopListening` with the event alone
        // removed EVERY handler on it: the bug `useAppUpdates` had on
        // `app-updates`, one level down.
        channel.stopListening(".app-release.available", handler);
      } catch { /* echo may be torn down already during HMR */ }
    };
  }, [role, reload, realtime]);

  // Promote broadcast (admin clicked Apply somewhere in the fleet):
  // re-sync so the "available" badge clears once the pointer moves.
  // Pass "panel" as thisApp so the hook's auto-`check()` only fires
  // for panel events — we just want the side-effect of re-fetching.
  useAppUpdates("panel", () => { void reload(); });

  return (
    <Ctx.Provider value={{ panel, agent, agentRollout, reload }}>
      {children}
    </Ctx.Provider>
  );
};

export const useUpdatesNotification = (): UpdatesNotificationState =>
  useContext(Ctx);
