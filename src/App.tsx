import { useAuth } from "@/auth/AuthContext";
import RoleGuard from "@/auth/RoleGuard";
import Layout from "@/components/Layout";
import Spinner from "@/components/ui/Spinner";
import { NotificationsProvider } from "@/notifications/NotificationsContext";
import { Suspense, lazy } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

/* Eagerly loaded — small + always needed (auth flow). */
import Home from "@/routes/Home";
import Login from "@/routes/Login";

/* Lazy-loaded — pulled in only when route is visited. */
const BookingDetails = lazy(() => import("@/routes/BookingDetails"));
const Bookings = lazy(() => import("@/routes/Bookings"));
const BranchEdit = lazy(() => import("@/routes/BranchEdit"));
const BranchHub = lazy(() => import("@/routes/BranchHub"));
const BranchLive = lazy(() => import("@/routes/BranchLive"));
const BranchPlaces = lazy(() => import("@/routes/BranchPlaces"));
const BranchServices = lazy(() => import("@/routes/BranchServices"));
const BranchSessions = lazy(() => import("@/routes/BranchSessions"));
const BranchesList = lazy(() => import("@/routes/BranchesList"));
const BranchesMap = lazy(() => import("@/routes/BranchesMap"));
const CompaniesList = lazy(() => import("@/routes/CompaniesList"));
const CompanyBranches = lazy(() => import("@/routes/CompanyBranches"));
const CompanyDetails = lazy(() => import("@/routes/CompanyDetails"));
const CompanyRevenue = lazy(() => import("@/routes/CompanyRevenue"));
const MyCompany = lazy(() => import("@/routes/MyCompany"));
const Revenue = lazy(() => import("@/routes/Revenue"));
const ConfirmByCode = lazy(() => import("@/routes/ConfirmByCode"));
const ForgotPassword = lazy(() => import("@/routes/ForgotPassword"));
const GamesList = lazy(() => import("@/routes/GamesList"));
const Managers = lazy(() => import("@/routes/Managers"));
const MemberCard = lazy(() => import("@/routes/MemberCard"));
const MembersList = lazy(() => import("@/routes/MembersList"));
const Notifications = lazy(() => import("@/routes/Notifications"));
const PcsList = lazy(() => import("@/routes/PcsList"));
const PosTerminal = lazy(() => import("@/routes/PosTerminal"));
const ProductsList = lazy(() => import("@/routes/ProductsList"));
const ResetPassword = lazy(() => import("@/routes/ResetPassword"));
const ServicesAdmin = lazy(() => import("@/routes/ServicesAdmin"));
const SessionsHistory = lazy(() => import("@/routes/SessionsHistory"));
const Settings = lazy(() => import("@/routes/Settings"));
const ShiftPanel = lazy(() => import("@/routes/ShiftPanel"));
const BranchPricesPage = lazy(() => import("@/routes/BranchPricesPage"));
const TournamentDetails = lazy(() => import("@/routes/TournamentDetails"));
const Tournaments = lazy(() => import("@/routes/Tournaments"));

const Authed = () => (
  <Suspense fallback={<Spinner />}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* Branches — admin & owner can list; manager goes directly to their branch */}
        <Route
          path="/branches"
          element={
            <RoleGuard perm="menu.branches">
              <BranchesList />
            </RoleGuard>
          }
        />
        <Route
          path="/branches-map"
          element={
            <RoleGuard perm="menu.map">
              <BranchesMap />
            </RoleGuard>
          }
        />
        <Route path="/branches/:branchId" element={<BranchHub />} />
        <Route
          path="/branches/:branchId/edit"
          element={
            <RoleGuard perm="branch.edit">
              <BranchEdit />
            </RoleGuard>
          }
        />
        <Route path="/branches/:branchId/live" element={<BranchLive />} />
        <Route path="/branches/:branchId/places" element={<BranchPlaces />} />
        <Route
          path="/branches/:branchId/services"
          element={<BranchServices />}
        />
        <Route
          path="/branches/:branchId/tournaments"
          element={<Tournaments />}
        />
        <Route
          path="/branches/:branchId/sessions"
          element={<BranchSessions />}
        />
        <Route
          path="/branches/:branchId/sessions/history"
          element={<SessionsHistory />}
        />
        <Route path="/branches/:branchId/pcs" element={<PcsList />} />
        <Route
          path="/branches/:branchId/tariffs"
          element={
            <RoleGuard perm="branch.prices">
              <BranchPricesPage />
            </RoleGuard>
          }
        />
        <Route path="/branches/:branchId/products" element={<ProductsList />} />
        <Route path="/branches/:branchId/pos" element={<PosTerminal />} />
        <Route path="/branches/:branchId/shift" element={<ShiftPanel />} />
        <Route path="/branches/:branchId/members" element={<MembersList />} />
        <Route
          path="/branches/:branchId/members/:memberId"
          element={<MemberCard />}
        />
        <Route
          path="/branches/:branchId/managers"
          element={
            <RoleGuard perm="manager.create">
              <Managers />
            </RoleGuard>
          }
        />

        {/* Bookings — everyone */}
        <Route path="/bookings" element={<Bookings />} />
        <Route
          path="/bookings/confirm"
          element={
            <RoleGuard perm="menu.scan">
              <ConfirmByCode />
            </RoleGuard>
          }
        />
        <Route path="/bookings/:bookingId" element={<BookingDetails />} />

        {/* Tournaments — visible to all roles that have menu.tournaments */}
        <Route
          path="/tournaments"
          element={
            <RoleGuard perm="menu.tournaments">
              <Tournaments />
            </RoleGuard>
          }
        />
        <Route
          path="/tournaments/:tournamentId"
          element={
            <RoleGuard perm="menu.tournaments">
              <TournamentDetails />
            </RoleGuard>
          }
        />

        {/* Universal */}
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />

        {/* Admin/owner only — hidden from manager */}
        <Route
          path="/managers"
          element={
            <RoleGuard perm="menu.managers">
              <Managers />
            </RoleGuard>
          }
        />
        <Route
          path="/games"
          element={
            <RoleGuard perm="menu.games">
              <GamesList />
            </RoleGuard>
          }
        />
        <Route
          path="/services-admin"
          element={
            <RoleGuard perm="menu.servicesAdmin">
              <ServicesAdmin />
            </RoleGuard>
          }
        />
        <Route
          path="/companies"
          element={
            <RoleGuard perm="menu.companies">
              <CompaniesList />
            </RoleGuard>
          }
        />
        <Route path="/companies/:companyId" element={<CompanyDetails />} />
        <Route
          path="/companies/:companyId/branches"
          element={<CompanyBranches />}
        />
        <Route
          path="/companies/:companyId/revenue"
          element={
            <RoleGuard perm="revenue.view">
              <CompanyRevenue />
            </RoleGuard>
          }
        />
        <Route
          path="/revenue"
          element={
            <RoleGuard perm="revenue.view">
              <Revenue />
            </RoleGuard>
          }
        />
        <Route
          path="/my-company"
          element={
            <RoleGuard perm="menu.myCompany">
              <MyCompany />
            </RoleGuard>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </Suspense>
);

const Unauthed = () => (
  <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Login />} />
    </Routes>
  </Suspense>
);

const App = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return (
    <HashRouter>
      {user ? (
        // NotificationsProvider only mounts when authed — its initial
        // fetch needs the sanctum token to be set, and the polling
        // tick has no purpose for an unauth'd visitor.
        <NotificationsProvider>
          <Authed />
        </NotificationsProvider>
      ) : (
        <Unauthed />
      )}
    </HashRouter>
  );
};

export default App;
