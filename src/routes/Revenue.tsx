import CompanyRevenueScreen from "@/components/revenue/CompanyRevenueScreen";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useState } from "react";

const Revenue = () => {
  const { data: companies, loading, error } = useAsync(() => companyRepository.list(), []);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const selected = (companies ?? []).find((c) => c.id === companyId) ?? null;

  return (
    <ScreenWithBg bg="./bg/company.jpg" title="Revenue & commission">
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="col" style={{ gap: 12 }}>
          <div className="col" style={{ gap: 6 }}>
            <span className="label">Company</span>
            <select
              className="input"
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— pick a company —</option>
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
          {!selected && <div className="muted">Pick a company to see its monthly revenue and commission.</div>}
        </div>
      )}
    </ScreenWithBg>
  );
};

export default Revenue;
