import { useAuth } from "@/auth/AuthContext";
import { sessionExpiry } from "@/auth/sessionExpiry";
import { useLang } from "@/i18n/LanguageContext";
import { getEcho } from "@/realtime/echo";
import { notify } from "@/ui/notify";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Acts on "an administrator just blocked your company / your branch" while the
 * panel is open.
 *
 * The backend already revokes the account's tokens when a block locks it out.
 * That stops the next REQUEST — it does nothing to the screen in front of the
 * person. A cashier whose venue was closed mid-shift goes on ringing up sales
 * against a cached page until something happens to call the API, which on a
 * quiet evening can be a long time. This is the other half: the block arrives
 * on the account's private channel and is applied to the running app at once.
 *
 * Two outcomes, because being blocked is not always being signed out:
 *
 *  - **`locked_out`** — the account has no workplace left. Sign out, showing the
 *    server's sentence (the same one the login screen would give them
 *    tomorrow), so the person reads one explanation rather than discovering it
 *    at the next login.
 *  - **not locked out** — an owner whose other branches are still open. The
 *    session stands; only the branch they are STANDING IN has closed, so leave
 *    that branch for the dashboard. Anywhere else, nothing visible happens
 *    beyond a refreshed `user`.
 *
 * Unblocking travels on the same channel and evicts nobody — it only refreshes
 * the cached account, so a branch that just reopened stops being reported as
 * closed without a manual reload.
 *
 * Mounted inside the router and inside the authed tree; renders nothing.
 */

/** Payload of the backend's `StaffAccessChanged` (`.access.changed`). */
interface AccessChangedPayload {
  action: "block" | "unblock";
  scope: "company" | "branch";
  company_id: number | null;
  branch_ids: number[];
  locked_out: boolean;
  message: string | null;
  at: string;
}

/**
 * The branch the panel is currently showing, or null. Every branch screen lives
 * under `/branches/{id}`, so the path is the whole answer — no screen has to
 * register itself here to be evictable.
 */
export const branchIdFromPath = (pathname: string): number | null => {
  const match = /^\/branches\/(\d+)(\/|$)/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
};

const AccessGuard = () => {
  const { user, logout, refreshUser } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  // Everything the listener needs is read through ONE ref, refreshed on every
  // render. The subscription then depends on the account id alone.
  //
  // That matters twice over. The route has to be the current one, and
  // re-subscribing on each navigation would leave a gap between unsubscribe and
  // re-subscribe in which a block is simply missed. And `logout` / `refreshUser`
  // are rebuilt whenever the auth context's user changes — refreshing the user
  // would otherwise tear the channel down and rebuild it as a side effect of
  // the very event that was just handled.
  const latest = useRef({ pathname: location.pathname, t, logout, refreshUser, navigate });
  latest.current = { pathname: location.pathname, t, logout, refreshUser, navigate };

  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.private(`user.${userId}.access`);

    const listener = (raw: unknown) => {
      const payload = raw as AccessChangedPayload;
      if (!payload?.action) return;
      const now = latest.current;

      if (payload.action === "block" && payload.locked_out) {
        notify.message("error", payload.message || now.t("blocking.evicted.lockedOut"));
        void now.logout();
        return;
      }

      if (payload.action === "block") {
        const current = branchIdFromPath(now.pathname);
        if (current !== null && payload.branch_ids.includes(current)) {
          notify.message("error", now.t("blocking.evicted.branch"));
          now.navigate("/", { replace: true });
        }
      }

      // Both directions: the account's cached payload (dashboard tiles, the
      // branch list it renders from) now describes a state that no longer
      // exists. A failed refresh is survivable — the context keeps the old user
      // and the next fetch retries.
      void now.refreshUser();
    };

    channel.listen(".access.changed", listener);
    return () => {
      channel.stopListening(".access.changed", listener);
    };
  }, [userId]);

  /**
   * The floor under the realtime path. Reverb can be unconfigured (no
   * `VITE_REVERB_KEY`), unreachable, or mid-reconnect at the moment the block
   * lands — and the account's tokens are already gone by then. Without this the
   * panel sits there looking signed in while every request it makes is refused,
   * which reads to the operator as "the app is broken" rather than "you have
   * been signed out".
   *
   * No toast: a bare 401 carries no explanation, and inventing one would risk
   * telling somebody they were blocked when their session had merely ended.
   */
  useEffect(() => {
    if (userId === null) return;
    return sessionExpiry.subscribe(() => {
      void latest.current.logout();
    });
  }, [userId]);

  return null;
};

export default AccessGuard;
