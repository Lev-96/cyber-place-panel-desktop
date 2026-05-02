import { apiGetMe, apiLogin } from "@/api/auth";
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
      const res = await apiLogin(email, password);
      await keyValueStore.set(AppConfig.storageKeys.token, res.token);
      const me = await apiGetMe();
      await keyValueStore.set(AppConfig.storageKeys.user, me.user);
      setUser(me.user);
    },
    logout: async () => {
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
