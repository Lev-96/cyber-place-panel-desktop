import { apiGetMe, apiLogin, apiLogout } from "@/api/auth";
import { disconnectEchoForSignOut } from "@/realtime/echo";
import { apiCache } from "@/api/client";
import { recentEmails } from "@/auth/recentEmails";
import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { AuthUser } from "@/types/api";
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-fetches /user/me and replaces the cached `user` (including
   * its `dashboard` payload). Callers use this to refresh
   * dashboard tiles in response to realtime events without a
   * manual reload.
   */
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const token = await keyValueStore.get<string>(AppConfig.storageKeys.token);
      if (!token) { setLoading(false); return; }
      try {
        const me = await apiGetMe();
        setUser(me.user);
        await keyValueStore.set(AppConfig.storageKeys.user, me.user);
      } catch {
        await keyValueStore.remove(AppConfig.storageKeys.token);
        await keyValueStore.remove(AppConfig.storageKeys.user);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    login: async (email, password) => {
      // Identity change = different data scope. A manager signing in
      // after an owner must never be able to read a response the owner's
      // session put in the cache, so the cache dies with the session on
      // BOTH ends of it.
      apiCache.clear();
      const res = await apiLogin(email, password);
      await keyValueStore.set(AppConfig.storageKeys.token, res.token);
      const me = await apiGetMe();
      await keyValueStore.set(AppConfig.storageKeys.user, me.user);
      // Remember the address for the login screen's suggestions — done HERE,
      // the single point every sign-in goes through (including switching to a
      // manager account), and only once the credentials actually worked.
      // Best effort: a storage hiccup must never fail a successful login.
      try { await recentEmails.remember(me.user.email ?? email); } catch { /* typing aid only */ }
      setUser(me.user);
    },
    logout: async () => {
      // Revoke the session on the server FIRST, while the token is still in
      // storage for the request to carry. Sanctum tokens have no expiry, so
      // without this a copy lifted off disk stays valid forever.
      //
      // Best effort by design: the operator must be able to sign out with the
      // backend unreachable, and a token that is already invalid returns 401.
      // Neither may trap them in a signed-in UI, so local state is cleared
      // either way.
      try {
        await apiLogout();
      } catch {
        /* offline, or the token was already revoked — sign out locally anyway */
      }
      apiCache.clear();
      // And the socket, before the next person signs in on this machine. A
      // channel stays subscribed after the components that asked for it are
      // gone, so without this an account switch leaves the new operator's
      // browser attached to the previous one's private channels — their
      // notifications, their support thread — on an authorisation that has
      // just been revoked.
      disconnectEchoForSignOut();
      await keyValueStore.remove(AppConfig.storageKeys.token);
      await keyValueStore.remove(AppConfig.storageKeys.user);
      setUser(null);
    },
    refreshUser: async () => {
      try {
        const me = await apiGetMe();
        await keyValueStore.set(AppConfig.storageKeys.user, me.user);
        setUser(me.user);
      } catch {
        // Network blip — keep the cached user so the UI doesn't blank
        // out. The next call (or polling tick / event) will retry.
      }
    },
  }), [user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
