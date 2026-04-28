import { useAuth } from "@/auth/AuthContext";
import Spinner from "@/components/ui/Spinner";
import { Navigate } from "react-router-dom";

/**
 * Owner shortcut: redirects to their own company's detail page.
 * The company_id is in the dashboard payload from `/user/me`.
 */
const MyCompany = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  const companyId = user?.dashboard?.company_id;
  if (!companyId) return <div className="error">No company linked to this account.</div>;
  return <Navigate to={`/companies/${companyId}`} replace />;
};

export default MyCompany;
