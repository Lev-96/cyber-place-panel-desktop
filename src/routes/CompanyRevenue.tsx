import CompanyRevenueScreen from "@/components/revenue/CompanyRevenueScreen";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useParams } from "react-router-dom";

const CompanyRevenue = () => {
  const { companyId } = useParams();
  const id = Number(companyId);
  const { data: company, loading, error } = useAsync(() => companyRepository.byId(id), [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid company id.</div>;
  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;
  const initialPercent = company?.raw?.commission_percent;
  const percent = initialPercent != null && initialPercent !== "" ? Number(initialPercent) : undefined;
  return <CompanyRevenueScreen companyId={id} companyName={company?.name} initialPercent={Number.isFinite(percent!) ? percent : undefined} />;
};

export default CompanyRevenue;
