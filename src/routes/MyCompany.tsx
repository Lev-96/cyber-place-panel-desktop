import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/auth/AuthContext";
import { StateView } from "@/components/ui/state";
import { Navigate } from "react-router-dom";

/**
 * Owner shortcut: redirects to their own company's detail page.
 * The company_id is in the dashboard payload from `/user/me`.
 */
const MyCompany = () => {
  const { user, loading } = useAuth();
  if (loading) return <SkeletonCard lines={4} />;
  const companyId = user?.dashboard?.company_id;
  // Not a failure: this account simply has no company yet.
  if (!companyId) return <StateView variant="empty" titleKey="revenue.state.noCompanyTitle" descriptionKey="myCompany.state.noCompanyDescription" />;
  return <Navigate to={`/companies/${companyId}`} replace />;
};

export default MyCompany;
