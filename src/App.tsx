import { useAuth } from "@/auth/AuthContext";
import Layout from "@/components/Layout";
import Spinner from "@/components/ui/Spinner";
import BranchLive from "@/routes/BranchLive";
import BranchSessions from "@/routes/BranchSessions";
import BranchesList from "@/routes/BranchesList";
import CompaniesList from "@/routes/CompaniesList";
import CompanyRevenue from "@/routes/CompanyRevenue";
import Home from "@/routes/Home";
import Login from "@/routes/Login";
import MemberCard from "@/routes/MemberCard";
import MembersList from "@/routes/MembersList";
import PcsList from "@/routes/PcsList";
import PosTerminal from "@/routes/PosTerminal";
import ProductsList from "@/routes/ProductsList";
import ShiftPanel from "@/routes/ShiftPanel";
import TimePackagesList from "@/routes/TimePackagesList";
import { ReactElement } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

const AdminGuard = ({ children }: { children: ReactElement }) => {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return children;
};

const Authed = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Home />} />
      <Route path="/branches" element={<BranchesList />} />
      <Route path="/branches/:branchId/live" element={<BranchLive />} />
      <Route path="/branches/:branchId/sessions" element={<BranchSessions />} />
      <Route path="/branches/:branchId/pcs" element={<PcsList />} />
      <Route path="/branches/:branchId/tariffs" element={<TimePackagesList />} />
      <Route path="/branches/:branchId/products" element={<ProductsList />} />
      <Route path="/branches/:branchId/pos" element={<PosTerminal />} />
      <Route path="/branches/:branchId/shift" element={<ShiftPanel />} />
      <Route path="/branches/:branchId/members" element={<MembersList />} />
      <Route path="/branches/:branchId/members/:memberId" element={<MemberCard />} />
      <Route path="/companies" element={<AdminGuard><CompaniesList /></AdminGuard>} />
      <Route path="/companies/:companyId/revenue" element={<AdminGuard><CompanyRevenue /></AdminGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
);

const App = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return (
    <HashRouter>
      {user ? <Authed /> : <Routes><Route path="*" element={<Login />} /></Routes>}
    </HashRouter>
  );
};

export default App;
