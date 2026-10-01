import { apiCache } from "@/api/client";
import { NetworkBlockCode, networkBlock } from "@/auth/networkBlock";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { disconnectEchoForSignOut } from "@/realtime/echo";
import { useEffect, useSyncExternalStore } from "react";

/** The address block, as React state — null while this device may use Cyber Place. */
export const useNetworkBlock = (): NetworkBlockCode | null =>
  useSyncExternalStore(networkBlock.subscribe, networkBlock.current, networkBlock.current);

/**
 * The whole app when this device is blocked (2026-10-01): one screen, nothing
 * behind it, and nothing about WHAT was blocked. Mounting it unmounts
 * every screen, poll and subscription; the cached responses and the realtime
 * socket are dropped too, so nothing from before the block stays on show or
 * keeps updating. The account is not signed out — the address is what is
 * refused — so "Check again" simply reloads, and a lifted block continues
 * where the person was.
 */
const NetworkBlockedScreen = ({ code }: { code: NetworkBlockCode }) => {
  const { t } = useLang();

  useEffect(() => {
    apiCache.clear();
    disconnectEchoForSignOut();
  }, []);

  return (
    <div className="login-shell net-block" role="alert">
      <img className="login-logo" src="./logo.png" alt="" />
      <h1 className="login-brand">Cyber Place</h1>
      <div className="login-card net-block__card">
        <h2 className="login-title">{t("networkBlock.title")}</h2>
        <p className="net-block__reason">{t(code === "suspended" ? "networkBlock.suspended" : "networkBlock.blocked")}</p>
        <Button type="button" onClick={() => window.location.reload()}>{t("networkBlock.retry")}</Button>
      </div>
    </div>
  );
};

export default NetworkBlockedScreen;
