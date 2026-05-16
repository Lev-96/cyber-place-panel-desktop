import { useAuth } from "@/auth/AuthContext";
import { apiAgentUpdateStatus } from "@/api/agent-updates";
import { apiCheckUpdates, type UpdateCheckEntry } from "@/api/updates";
import { useAppUpdates } from "@/realtime/useAppUpdates";
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
 * Three triggers refresh the snapshot:
 *   1. Initial fetch on mount (so a freshly logged-in user sees the
 *      badge immediately, not after a 60s wait).
 *   2. 60-second poll — backstops the "GitHub has a new release but
 *      no one has promoted yet, so no broadcast fires" gap.
 *   3. `.app-update.promoted` Reverb broadcast — any promote (this
 *      panel's own or another partner's) re-fetches so the badge
 *      clears across the fleet without manual reload.
 */

const POLL_INTERVAL_MS = 60_000;

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

  // Broadcast: any promote (anywhere) re-syncs the badge/toast state.
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
