import { useAuth } from "@/auth/AuthContext";
import GradientText from "@/components/ui/GradientText";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { useBookingChanged } from "@/realtime/useBookingChanged";
import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

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

  useBookingChanged("bookings.global", debouncedRefreshUser);
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "company_owner";
  const isManager = user?.role === "manager";
  const dash = user?.dashboard ?? {};
  const myBranchId = typeof dash.branch_id === "number" ? dash.branch_id : null;
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

      <div className="stat-grid">
        {isAdmin && (
          <>
            <Tile k={t("home.companies")} v={dash.total_companies ?? 0} />
            <Tile k={t("home.branches")} v={dash.total_branches ?? 0} />
            <Tile k={t("home.places")} v={dash.total_places ?? 0} />
            <Tile k={t("home.bookings")} v={dash.total_bookings ?? 0} />
          </>
        )}
        {isOwner && (
          <>
            <Tile k={t("home.activeBranches")} v={dash.active_branches ?? 0} />
            <Tile
              k={t("home.todaysBookings")}
              v={dash.total_bookings_today ?? 0}
            />
            <Tile k={t("home.upcoming")} v={dash.upcoming_bookings ?? 0} />
            <Tile k={t("home.allPlaces")} v={dash.all_places ?? 0} />
          </>
        )}
        {!isAdmin && !isOwner && (
          <>
            <Tile
              k={t("home.todaysBookings")}
              v={dash.total_bookings_today ?? 0}
            />
            <Tile k={t("home.upcoming")} v={dash.upcoming_bookings ?? 0} />
          </>
        )}
      </div>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        {(isAdmin || isOwner) && (
          <Link to="/branches" className="card" style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {t("home.menu.branches")}
            </div>
            <div className="muted">{t("home.menu.branchesSub")}</div>
          </Link>
        )}
        {isManager && myBranchId !== null && (
          <Link to={`/branches/${myBranchId}`} className="card" style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {t("home.menu.myBranch")}
            </div>
            <div className="muted">{t("home.menu.myBranchSub")}</div>
          </Link>
        )}
        <Link to="/bookings" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {t("home.menu.bookings")}
          </div>
          <div className="muted">{t("home.menu.bookingsSub")}</div>
        </Link>
        {isAdmin && (
          <Link to="/companies" className="card" style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {t("home.menu.companies")}
            </div>
            <div className="muted">{t("home.menu.companiesSub")}</div>
          </Link>
        )}
        <Link to="/settings" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {t("home.menu.settings")}
          </div>
          <div className="muted">{t("home.menu.settingsSub")}</div>
        </Link>
      </div>
    </ScreenWithBg>
  );
};

const Tile = ({ k, v }: { k: string; v: number | string }) => (
  <div className="stat-tile">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

export default Home;
