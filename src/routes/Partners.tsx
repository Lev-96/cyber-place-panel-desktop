import PartnersScreen from "@/components/partners/PartnersScreen";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { SkeletonStats } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useState } from "react";

/**
 * «Мои партнёры» (2026-11-18, owner; admin too). An owner's company is the one
 * the scoped list returns, chosen without asking; an admin with several picks
 * one, as on the revenue screen. The server refuses a company the caller may
 * not reach whatever is asked.
 */
const Partners = () => {
  const { t } = useLang();
  const { data: companies, loading, error, reload } = useAsync(() => companyRepository.list(), []);
  const [picked, setPicked] = useState<number | null>(null);
  const list = companies ?? [];
  const companyId = list.length === 1 ? list[0].id : picked;

  return (
    <ScreenWithBg bg="./bg/company.jpg" title={t("partners.title")}>
      <StateSwitch
        view={deriveViewState({ loading, error, data: companies })}
        skeleton={<SkeletonStats tiles={3} />}
        onRetry={() => void reload()}
        error={{ titleKey: "companies.state.errorTitle" }}
        empty={{ titleKey: "revenue.state.noCompanyTitle", descriptionKey: "partners.state.noCompanyDescription" }}
      >
        <div className="col" style={{ gap: 12 }} data-testid="partners-screen">
          {list.length > 1 && (
            <label className="col" style={{ gap: 6 }}>
              <span className="label">{t("label.company")}</span>
              <select
                className="input"
                value={picked ?? ""}
                onChange={(e) => setPicked(e.target.value ? Number(e.target.value) : null)}
                data-testid="partners-company"
              >
                <option value="">{t("revenue.pickCompany")}</option>
                {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {/* Keyed: another company starts on its own list, never the previous one's. */}
          {companyId !== null && <PartnersScreen key={companyId} companyId={companyId} />}
        </div>
      </StateSwitch>
    </ScreenWithBg>
  );
};

export default Partners;
