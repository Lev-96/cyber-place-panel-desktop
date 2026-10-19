import { SkeletonStats } from "@/components/ui/Skeleton";
import CompanyRevenueScreen from "@/components/revenue/CompanyRevenueScreen";
import { BackAction, ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useParams } from "react-router-dom";

const CompanyRevenue = () => {
  const { companyId } = useParams();
  const { t } = useLang();
  const id = Number(companyId);
  const { data: company, loading, error, reload } = useAsync(() => companyRepository.byId(id), [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("error.invalidCompanyId")}</div>;
  // A refresh in the background must not unmount the screen (and its month
  // picker) under the operator: the company on hand stays while it runs.
  if (error && !company) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void reload()}
        titleKey="company.state.errorTitle"
        notFoundTitleKey="company.state.notFoundTitle"
        notFoundDescriptionKey="company.state.notFoundDescription"
        notFoundAction={<BackAction />}
      />
    );
  }
  if (loading && !company) return <SkeletonStats tiles={3} />;
  const initialPercent = company?.raw?.commission_percent;
  const percent = initialPercent != null && initialPercent !== "" ? Number(initialPercent) : undefined;
  return <CompanyRevenueScreen companyId={id} companyName={company?.name} initialPercent={Number.isFinite(percent!) ? percent : undefined} />;
};

export default CompanyRevenue;
