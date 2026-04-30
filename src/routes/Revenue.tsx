import CompanyRevenueScreen from "@/components/revenue/CompanyRevenueScreen";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useState } from "react";

const Revenue = () => {
  const { t } = useLang();
  const { data: companies, loading, error } = useAsync(() => companyRepository.list(), []);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const selected = (companies ?? []).find((c) => c.id === companyId) ?? null;

  return (
    <ScreenWithBg bg="./bg/company.jpg" title={t("revenue.title")}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="col" style={{ gap: 12 }}>
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{t("label.company")}</span>
            <select
              className="input"
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("revenue.pickCompany")}</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selected && (
            <CompanyRevenueScreen
              companyId={selected.id}
              companyName={selected.name}
              initialPercent={
                selected.raw.commission_percent != null && selected.raw.commission_percent !== ""
                  ? Number(selected.raw.commission_percent)
                  : undefined
              }
            />
          )}
          {!selected && <div className="muted">{t("revenue.pickHint")}</div>}
        </div>
      )}
    </ScreenWithBg>
  );
};

export default Revenue;
