import BlockedCountriesTab from "@/components/security/BlockedCountriesTab";
import BlockedIpsTab from "@/components/security/BlockedIpsTab";
import IpActivityTab from "@/components/security/IpActivityTab";
import {
  SecurityRefreshContext, SecurityRefreshRegistry, SecurityReload, refreshAll,
} from "@/components/security/securityRefresh";
import Button from "@/components/ui/Button";
import RefreshIcon from "@/components/ui/RefreshIcon";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import SectionTabs, { SectionTab } from "@/components/ui/SectionTabs";
import { useLang } from "@/i18n/LanguageContext";
import { notify } from "@/ui/notify";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type SecurityTab = "ips" | "countries" | "activity";

const TABS: readonly SecurityTab[] = ["ips", "countries", "activity"];

const TAB_LABEL_KEY = {
  ips: "security.tab.ips",
  countries: "security.tab.countries",
  activity: "security.tab.activity",
} as const satisfies Record<SecurityTab, string>;

/** `?tab=` as the URL says, or the first tab for anything it does not name. */
export const securityTabOf = (value: string | null): SecurityTab =>
  (TABS as readonly string[]).includes(value ?? "") ? (value as SecurityTab) : "ips";

/**
 * The admin's Security section (`/security?tab=…`): blocked IP addresses,
 * blocked countries and the IP activity (2026-09-29, activity 2026-09-30; web and Telegram access is by role, nothing
 * to grant here). The tab lives in the URL,
 * so a link, a reload or Back lands on the same one. Each tab owns its own
 * reads and mounts only while shown: nothing here is fetched for a tab nobody
 * opened.
 *
 * Refresh (2026-10-09) re-reads the lists on screen — whatever registered
 * through `SecurityRefreshContext` — with their current search, filters and
 * page, replacing what is shown. One round at a time; a green toast only when
 * every list answered, otherwise a red one and the list's own ErrorState.
 */
const Security = () => {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const tab = securityTabOf(params.get("tab"));

  const tabs: SectionTab<SecurityTab>[] = TABS.map((key) => ({ key, label: t(TAB_LABEL_KEY[key]) }));

  const reloads = useRef(new Set<SecurityReload>());
  const registry = useMemo<SecurityRefreshRegistry>(() => ({
    register: (reload) => {
      reloads.current.add(reload);
      return () => { reloads.current.delete(reload); };
    },
  }), []);

  // The ref is the guard (a second click lands before `busy` re-renders);
  // the state is what the button shows.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (await refreshAll(reloads.current)) notify.success("security", "refreshed");
      else notify.error("security", "refreshed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={t("security.title")}>
      <SecurityRefreshContext.Provider value={registry}>
        <div className="sec-page">
          <div className="sec-head">
            <SectionTabs
              tabs={tabs}
              value={tab}
              onChange={(key) => setParams({ tab: key }, { replace: true })}
              label={t("security.title")}
            />
            <Button
              type="button"
              variant="secondary"
              className={`sec-refresh${busy ? " is-busy" : ""}`}
              onClick={() => void refresh()}
              disabled={busy}
              aria-busy={busy}
            >
              <RefreshIcon className="sec-refresh__icon" />
              <span>{t("action.refresh")}</span>
            </Button>
          </div>
          <div role="tabpanel" className="sec-panel">
            {tab === "ips" && <BlockedIpsTab />}
            {tab === "countries" && <BlockedCountriesTab />}
            {tab === "activity" && <IpActivityTab />}
          </div>
        </div>
      </SecurityRefreshContext.Provider>
    </ScreenWithBg>
  );
};

export default Security;
