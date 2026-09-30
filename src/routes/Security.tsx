import BlockedCountriesTab from "@/components/security/BlockedCountriesTab";
import BlockedIpsTab from "@/components/security/BlockedIpsTab";
import IpActivityTab from "@/components/security/IpActivityTab";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import SectionTabs, { SectionTab } from "@/components/ui/SectionTabs";
import { useLang } from "@/i18n/LanguageContext";
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
 */
const Security = () => {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const tab = securityTabOf(params.get("tab"));

  const tabs: SectionTab<SecurityTab>[] = TABS.map((key) => ({ key, label: t(TAB_LABEL_KEY[key]) }));

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={t("security.title")}>
      <div className="sec-page">
        <SectionTabs
          tabs={tabs}
          value={tab}
          onChange={(key) => setParams({ tab: key }, { replace: true })}
          label={t("security.title")}
        />
        <div role="tabpanel" className="sec-panel">
          {tab === "ips" && <BlockedIpsTab />}
          {tab === "countries" && <BlockedCountriesTab />}
          {tab === "activity" && <IpActivityTab />}
        </div>
      </div>
    </ScreenWithBg>
  );
};

export default Security;
