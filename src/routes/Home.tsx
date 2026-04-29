import { useAuth } from "@/auth/AuthContext";
import GradientText from "@/components/ui/GradientText";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";

const Home = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "company_owner";
  const dash: any = user?.dashboard ?? {};
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
            <Tile
              k={t("home.occupiedNow")}
              v={dash.occupied_places_right_now ?? "0/0"}
            />
          </>
        )}
        {!isAdmin && !isOwner && (
          <>
            <Tile
              k={t("home.todaysBookings")}
              v={dash.total_bookings_today ?? 0}
            />
            <Tile k={t("home.upcoming")} v={dash.upcoming_bookings ?? 0} />
            <Tile
              k={t("home.occupiedNow")}
              v={dash.occupied_places_right_now ?? "0/0"}
            />
          </>
        )}
      </div>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <Link to="/branches" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {t("home.menu.branches")}
          </div>
          <div className="muted">{t("home.menu.branchesSub")}</div>
        </Link>
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
