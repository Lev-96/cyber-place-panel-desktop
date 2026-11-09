import { useAuth } from "@/auth/AuthContext";
import PlatformDebtCard from "@/components/platformBilling/PlatformDebtCard";
import PlatformFleetCard from "@/components/platformBilling/PlatformFleetCard";
import GradientText from "@/components/ui/GradientText";
import NavIcon from "@/components/ui/NavIcon";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { resolveBookingScopeChannel } from "@/realtime/bookingScope";
import { useBookingChanged } from "@/realtime/useBookingChanged";
import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

interface TileSpec {
  key: string;
  /** NavIcon id. */
  icon: string;
  labelKey: string;
  value: number | string;
}

interface LinkSpec {
  to: string;
  /** NavIcon id: the same shape the side menu draws for the same place. */
  icon: string;
  titleKey: string;
  subKey: string;
}

const Home = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useLang();

  // Dashboard tiles (Occupied now, Today's bookings, Upcoming, etc.)
  // come from the `/user/me` payload which is populated at login.
  // To keep them honest in real time, refetch on every booking event
  // — debounced so a fan-out of multiple events for the same booking
  // doesn't trigger N requests.
  //
  // The refresh is FYI-only: if the network is slow or the request
  // fails, AuthContext keeps the previous user payload, so the page
  // never blanks out.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefreshUser = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void refreshUser();
    }, 400);
  }, [refreshUser]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  // Fetch fresh dashboard counts on every mount — the user payload
  // hangs around in AuthContext between route changes, so without
  // this the tiles render with whatever was current at last login or
  // last realtime event. Bookings made on another desktop / mobile
  // wouldn't show until the next event arrived. Fire-and-forget; if
  // it fails AuthContext keeps the cached payload.
  //
  // Ref-route around the dep cycle: AuthContext re-creates refreshUser
  // whenever `user` updates (it's part of the memoised context value),
  // and the refresh itself updates `user`. Listing it as a dep would
  // loop on every refresh. We only want one fetch per mount.
  const refreshUserRef = useRef(refreshUser);
  useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  useEffect(() => {
    void refreshUserRef.current();
  }, []);

  // Was `bookings.global` for every role — an owner's machine received every
  // booking on the platform just to know when to refresh its own dashboard.
  const bookingScope = resolveBookingScopeChannel(user);
  useBookingChanged(bookingScope?.name, debouncedRefreshUser, bookingScope?.isPrivate ?? false);
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "company_owner";
  const isManager = user?.role === "manager";
  const dash = user?.dashboard ?? {};
  const myBranchId = typeof dash.branch_id === "number" ? dash.branch_id : null;
  // What the dashboard shows each role. Owner "Places" was dropped on
  // 2026-11-09 (owner): the count stays in the payload (`all_places`) for
  // older panels, it is simply not drawn.
  const tiles: TileSpec[] = isAdmin
    ? [
        { key: "companies", icon: "nav.companies", labelKey: "home.companies", value: dash.total_companies ?? 0 },
        { key: "branches", icon: "nav.branches", labelKey: "home.branches", value: dash.total_branches ?? 0 },
        { key: "places", icon: "branch.places", labelKey: "home.places", value: dash.total_places ?? 0 },
        { key: "bookings", icon: "nav.bookings", labelKey: "home.bookings", value: dash.total_bookings ?? 0 },
      ]
    : [
        ...(isOwner
          ? [{ key: "activeBranches", icon: "nav.branches", labelKey: "home.activeBranches", value: dash.active_branches ?? 0 }]
          : []),
        { key: "today", icon: "nav.bookings", labelKey: "home.todaysBookings", value: dash.total_bookings_today ?? 0 },
        { key: "upcoming", icon: "home.upcoming", labelKey: "home.upcoming", value: dash.upcoming_bookings ?? 0 },
      ];

  // The owner's dashboard is the figures and the platform bill (2026-11-09):
  // the Branches / Bookings / Settings shortcuts are in the side menu already.
  const links: LinkSpec[] = isOwner ? [] : [
    ...((isAdmin || isOwner)
      ? [{ to: "/branches", icon: "nav.branches", titleKey: "home.menu.branches", subKey: "home.menu.branchesSub" }]
      : []),
    ...(isManager && myBranchId !== null
      ? [{ to: `/branches/${myBranchId}`, icon: "nav.myBranch", titleKey: "home.menu.myBranch", subKey: "home.menu.myBranchSub" }]
      : []),
    { to: "/bookings", icon: "nav.bookings", titleKey: "home.menu.bookings", subKey: "home.menu.bookingsSub" },
    ...(isAdmin
      ? [
          { to: "/companies", icon: "nav.companies", titleKey: "home.menu.companies", subKey: "home.menu.companiesSub" },
          { to: "/expenses", icon: "nav.expenses", titleKey: "home.menu.expenses", subKey: "home.menu.expensesSub" },
          // Website analytics + backend monitoring both live in "Метрики"; the
          // Pulse entry sits inside that screen. Admin-only in the UI AND on
          // the server, so this tile is convenience, not the access control.
          { to: "/metrics", icon: "nav.metrics", titleKey: "home.menu.metrics", subKey: "home.menu.metricsSub" },
        ]
      : []),
    { to: "/settings", icon: "nav.settings", titleKey: "home.menu.settings", subKey: "home.menu.settingsSub" },
  ];

  const bg = isAdmin
    ? "./bg/admin-home.jpg"
    : isOwner
      ? "./bg/owner-home.jpg"
      : "./bg/manager-home.jpg";

  return (
    <ScreenWithBg bg={bg}>
      <div>
        <div className="muted" style={{ fontSize: 13 }}>
          {t("home.welcomeBack")}
        </div>
        <GradientText style={{ fontSize: 32 }}>{user?.name}</GradientText>
      </div>

      <div className="home-layout">
        <div className="home-main">
          <div className={isOwner ? "stat-grid stat-grid--fill" : "stat-grid"}>
            {tiles.map((tile) => (
              <Tile key={tile.key} icon={tile.icon} k={t(tile.labelKey)} v={tile.value} />
            ))}
          </div>

          {/* The owner's platform bill: as wide as the tiles above it (2026-11-09). */}
          {isOwner && typeof dash.company_id === "number" && <PlatformDebtCard companyId={dash.company_id} />}

          {links.length > 0 && (
          <nav className="home-links" aria-label={t("nav.dashboard")}>
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="card home-link">
                <NavIcon id={link.icon} size={22} />
                <span className="home-link__text">
                  <span className="home-link__title">{t(link.titleKey)}</span>
                  <span className="muted home-link__sub">{t(link.subKey)}</span>
                </span>
              </Link>
            ))}
          </nav>
          )}
        </div>

        {/* The platform's bill, on the right (2026-11-09). Each card renders
            nothing for a backend without platform billing, and `.home-aside`
            hides itself when empty, so the dashboard is then exactly the old
            one. A manager never gets it (no revenue.view). */}
        {isAdmin && (
          <aside className="home-aside">
            <PlatformFleetCard />
          </aside>
        )}
      </div>
    </ScreenWithBg>
  );
};

const Tile = ({ icon, k, v }: { icon: string; k: string; v: number | string }) => (
  <div className="stat-tile">
    <span className="stat-tile__head">
      <NavIcon id={icon} />
      <span className="k">{k}</span>
    </span>
    <span className="v">{v}</span>
  </div>
);

export default Home;
