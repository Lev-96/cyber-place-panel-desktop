import { useAuth } from "@/auth/AuthContext";
import AuthRouteReset from "@/auth/AuthRouteReset";
import TelemetryTracker from "@/telemetry/TelemetryTracker";
import RoleGuard from "@/auth/RoleGuard";
import { AccountLanguageGate } from "@/i18n/LanguageGates";
import Layout from "@/components/Layout";
import UpdateReadyModal from "@/components/UpdateReadyModal";
import UpdatesToast from "@/components/UpdatesToast";
import Spinner from "@/components/ui/Spinner";
import Toaster from "@/components/ui/Toaster";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { NotificationsProvider } from "@/notifications/NotificationsContext";
import AccessGuard from "@/realtime/AccessGuard";
import { primeRealtimeConfig } from "@/realtime/echo";
import BranchVisibilityGuard from "@/realtime/BranchVisibilityGuard";
import BlockedBranchGuard from "@/routes/BlockedBranchGuard";
import { useAppUpdates, useUpdateCatchUp } from "@/realtime/useAppUpdates";
import { UpdatesNotificationProvider } from "@/realtime/UpdatesNotificationContext";
import { Suspense, lazy, useEffect } from "react";
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
const BranchGames = lazy(() => import("@/routes/BranchGames"));
const BranchSessions = lazy(() => import("@/routes/BranchSessions"));
const BranchesList = lazy(() => import("@/routes/BranchesList"));
const BranchesMap = lazy(() => import("@/routes/BranchesMap"));
const CompaniesList = lazy(() => import("@/routes/CompaniesList"));
const CompanyBranches = lazy(() => import("@/routes/CompanyBranches"));
const CompanyDetails = lazy(() => import("@/routes/CompanyDetails"));
const CompanyRevenue = lazy(() => import("@/routes/CompanyRevenue"));
const Expenses = lazy(() => import("@/routes/Expenses"));
const Metrics = lazy(() => import("@/routes/Metrics"));
const MyCompany = lazy(() => import("@/routes/MyCompany"));
const Revenue = lazy(() => import("@/routes/Revenue"));
const ConfirmByCode = lazy(() => import("@/routes/ConfirmByCode"));
const GamesList = lazy(() => import("@/routes/GamesList"));
const Managers = lazy(() => import("@/routes/Managers"));
const MemberCard = lazy(() => import("@/routes/MemberCard"));
const MembersList = lazy(() => import("@/routes/MembersList"));
const Notifications = lazy(() => import("@/routes/Notifications"));
const SupportChat = lazy(() => import("@/routes/SupportChat"));
const PcsList = lazy(() => import("@/routes/PcsList"));
const PosTerminal = lazy(() => import("@/routes/PosTerminal"));
const ProductsList = lazy(() => import("@/routes/ProductsList"));
const ResetPassword = lazy(() => import("@/routes/ResetPassword"));
const SessionsHistory = lazy(() => import("@/routes/SessionsHistory"));
const Settings = lazy(() => import("@/routes/Settings"));
const AppUpdates = lazy(() => import("@/routes/AppUpdates"));
const AgentUpdates = lazy(() => import("@/routes/AgentUpdates"));
const ShiftPanel = lazy(() => import("@/routes/ShiftPanel"));
const BranchPricesPage = lazy(() => import("@/routes/BranchPricesPage"));
const BranchSubscribersPage = lazy(() => import("@/routes/BranchSubscribersPage"));
const TournamentDetails = lazy(() => import("@/routes/TournamentDetails"));
const Tournaments = lazy(() => import("@/routes/Tournaments"));

const Authed = () => {
  // App-wide subscription to the Reverb `app-update.promoted` broadcast.
  // The AppUpdates admin screen ALSO subscribes (for its own re-fetch),
  // but Echo de-duplicates the channel so a second subscription is free.
  // Lifting the subscription to the root means owner/manager — who never
  // visit /settings/updates — still trigger their local electron-updater
  // immediately when admin promotes, not only on the next app boot.
  useAppUpdates("panel");
  // Catch up on a promote this panel missed while offline — reads the
  // backend manifest and runs the gated check so only the admin-promoted
  // version installs. Mounted once here at the authed root.
  useUpdateCatchUp("panel");

  return (
  <Suspense fallback={<Spinner />}>
    <UpdateReadyModal />
    <UpdatesToast />
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
        {/* Everything INSIDE a branch. A branch an administrator has taken
            out of service still has a page — that is where its state is shown
            and where an admin lifts the block — but none of its working
            screens. Without this an owner whose other venues are open stays
            signed in and can walk into the closed one from the branch list and
            ring up a sale in it. Admins pass through; see the guard. */}
        <Route element={<BlockedBranchGuard />}>
          <Route
            path="/branches/:branchId/edit"
            element={
              <RoleGuard perm="branch.edit">
                <BranchEdit />
              </RoleGuard>
            }
          />
          <Route path="/branches/:branchId/live" element={<BranchLive />} />
          <Route
            path="/branches/:branchId/places"
            element={
              <RoleGuard perm="branch.places">
                <BranchPlaces />
              </RoleGuard>
            }
          />
          <Route
            path="/branches/:branchId/games"
            element={
              <RoleGuard perm="game.crud.branch">
                <BranchGames />
              </RoleGuard>
            }
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
          <Route
            path="/branches/:branchId/subscribers"
            element={<BranchSubscribersPage />}
          />
          <Route path="/branches/:branchId/products" element={<ProductsList />} />
          <Route path="/branches/:branchId/pos" element={<PosTerminal />} />
          <Route
            path="/branches/:branchId/shift"
            element={
              <RoleGuard perm="shift.open">
                <ShiftPanel />
              </RoleGuard>
            }
          />
          {/* Member cards and deposits are administrative. Guarding the route
              as well as the tile is the point: a bookmarked URL is the other
              way into a section, and the backend refuses these reads too. */}
          <Route
            path="/branches/:branchId/members"
            element={
              <RoleGuard perm="branch.members">
                <MembersList />
              </RoleGuard>
            }
          />
          <Route
            path="/branches/:branchId/members/:memberId"
            element={
              <RoleGuard perm="branch.members">
                <MemberCard />
              </RoleGuard>
            }
          />
          <Route
            path="/branches/:branchId/managers"
            element={
              <RoleGuard perm="manager.create">
                <Managers />
              </RoleGuard>
            }
          />
        </Route>

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
        <Route
          path="/support"
          element={
            <RoleGuard perm="menu.support">
              <SupportChat />
            </RoleGuard>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/settings/updates"
          element={
            <RoleGuard perm="menu.updates">
              <AppUpdates />
            </RoleGuard>
          }
        />
        <Route
          path="/settings/agent-updates"
          element={
            <RoleGuard perm="menu.agentUpdates">
              <AgentUpdates />
            </RoleGuard>
          }
        />

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
          path="/expenses"
          element={
            <RoleGuard perm="menu.expenses">
              <Expenses />
            </RoleGuard>
          }
        />
        {/* Website analytics (Yandex.Metrica) + entry to backend monitoring.
            Admin-only here and on the backend's `admin` guard. */}
        <Route
          path="/metrics"
          element={
            <RoleGuard perm="menu.metrics">
              <Metrics />
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
};

const Unauthed = () => (
  <Suspense fallback={<Spinner />}>
    <Routes>
      {/* The reset request is the reverse face of the sign-in card, not a
          separate page — Login reads the path and opens already turned. Keeping
          the URL means a deep link, a bookmark and the browser's Back button
          all still work. */}
      <Route path="/forgot-password" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Login />} />
    </Routes>
  </Suspense>
);

const App = () => {
  const { user, loading } = useAuth();

  // Ask the backend which socket to connect to, before anything subscribes.
  // `VITE_REVERB_*` is only a fallback now: a build carrying a key the servers
  // no longer run was refused with Pusher 4001 for its whole life while every
  // screen quietly polled. Asking the broadcaster removes that class of failure
  // and repairs an already-shipped build at launch.
  useEffect(() => {
    void primeRealtimeConfig();
  }, []);

  if (loading) return <Spinner />;
  return (
    <ConfirmProvider>
      {/* CRUD toaster + confirm dialogs live at the app root so they work on
          BOTH the authed screens and the unauth'd flow (login / forgot
          password), and so no native confirm()/alert() poisons focus. */}
      <Toaster />
      <HashRouter>
        {/* Signing in / out / switching account always lands on the
            dashboard — a route must never outlive the account that
            opened it. Must live INSIDE the router to navigate. */}
        <AuthRouteReset />
        {/* Usage + error reporting for the "Мониторинг · Десктоп-панель"
            section. Inside the router so it can see navigation; renders
            nothing. */}
        <TelemetryTracker />
        {user ? (
          // NotificationsProvider only mounts when authed — its initial
          // fetch needs the sanctum token to be set, and the polling
          // tick has no purpose for an unauth'd visitor.
          <NotificationsProvider>
            {/* An administrator blocking this account's company or branch has
                to reach the screen that is already open, not just the next
                request. Mounted for authed users only — there is nothing to
                evict anyone from before sign-in. Renders nothing. */}
            <AccessGuard />
            {/* The same block seen from the other side: an administrator on
                another machine closing or reopening a venue. Keeps this
                panel's lists and branch pages from describing a state that
                ended a minute ago. Renders nothing. */}
            <BranchVisibilityGuard />
            <UpdatesNotificationProvider>
              {/* Per-account language step. Wraps the authed tree rather than
                  sitting on a route so it cannot be skipped by a restored deep
                  link — HashRouter reopens the last hash on launch. It also
                  applies the account's stored language before the cabinet
                  renders, so nothing flashes in the previous one. */}
              <AccountLanguageGate>
                <Authed />
              </AccountLanguageGate>
            </UpdatesNotificationProvider>
          </NotificationsProvider>
        ) : (
          <Unauthed />
        )}
      </HashRouter>
    </ConfirmProvider>
  );
};

export default App;
