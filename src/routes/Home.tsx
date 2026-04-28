import { useAuth } from "@/auth/AuthContext";
import GradientText from "@/components/ui/GradientText";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { Link } from "react-router-dom";

const Home = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "company_owner";
  const dash: any = user?.dashboard ?? {};
  const bg = isAdmin ? "./bg/admin-home.jpg" : isOwner ? "./bg/owner-home.jpg" : "./bg/manager-home.jpg";

  return (
    <ScreenWithBg bg={bg}>
      <div>
        <div className="muted" style={{ fontSize: 13 }}>Welcome back,</div>
        <GradientText style={{ fontSize: 32 }}>{user?.name}</GradientText>
      </div>

      <div className="stat-grid">
        {isAdmin && <>
          <Tile k="Companies" v={dash.total_companies ?? 0} />
          <Tile k="Branches" v={dash.total_branches ?? 0} />
          <Tile k="Places" v={dash.total_places ?? 0} />
          <Tile k="Bookings" v={dash.total_bookings ?? 0} />
        </>}
        {isOwner && <>
          <Tile k="Active branches" v={dash.active_branches ?? 0} />
          <Tile k="Today's bookings" v={dash.total_bookings_today ?? 0} />
          <Tile k="Upcoming" v={dash.upcoming_bookings ?? 0} />
          <Tile k="Places" v={dash.all_places ?? 0} />
          <Tile k="Occupied now" v={dash.occupied_places_right_now ?? "0/0"} />
        </>}
        {!isAdmin && !isOwner && <>
          <Tile k="Today's bookings" v={dash.total_bookings_today ?? 0} />
          <Tile k="Upcoming" v={dash.upcoming_bookings ?? 0} />
          <Tile k="Occupied now" v={dash.occupied_places_right_now ?? "0/0"} />
        </>}
      </div>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <Link to="/branches" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Branches</div>
          <div className="muted">Live, sessions, POS, members</div>
        </Link>
        <Link to="/bookings" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Bookings</div>
          <div className="muted">All bookings</div>
        </Link>
        {isAdmin && (
          <Link to="/companies" className="card" style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Companies</div>
            <div className="muted">Commission &amp; revenue</div>
          </Link>
        )}
        <Link to="/settings" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Settings</div>
          <div className="muted">Account &amp; password</div>
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
