import SectionTabs from "@/components/ui/SectionTabs";
import { useLang } from "@/i18n/LanguageContext";
import { useState } from "react";
import PartnerList from "./PartnerList";
import PartnerSettlementView from "./PartnerSettlementView";

type Pane = "list" | "settlement";

/**
 * «Мои партнёры» of one company (2026-11-18, owner): the partners, and the
 * month's settlement with them, as two tabs. Partners have no login.
 */
const PartnersScreen = ({ companyId }: { companyId: number }) => {
  const { t } = useLang();
  const [pane, setPane] = useState<Pane>("list");
  return (
    <div className="col" style={{ gap: 14 }}>
      <p className="muted" style={{ margin: 0 }}>{t("partners.intro")}</p>
      <div className="cp-subtabs-wrap">
      <SectionTabs
        label={t("partners.views")}
        value={pane}
        onChange={setPane}
        tabs={[
          { key: "list", label: t("partners.tabList") },
          { key: "settlement", label: t("partners.tabSettlement") },
        ]}
      />
      </div>
      {pane === "list" ? <PartnerList companyId={companyId} /> : <PartnerSettlementView companyId={companyId} />}
    </div>
  );
};

export default PartnersScreen;
