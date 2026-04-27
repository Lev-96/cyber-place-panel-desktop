import { useAuth } from "@/auth/AuthContext";
import { Link } from "react-router-dom";

const Home = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2 className="page-title">Welcome, {user?.name}</h2>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <Link to="/branches" className="card" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Branches</div>
          <div className="muted">Live monitoring of places &amp; services</div>
        </Link>
        {isAdmin && (
          <Link to="/companies" className="card" style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Companies</div>
            <div className="muted">Commission &amp; monthly billing</div>
          </Link>
        )}
      </div>
    </div>
  );
};

export default Home;
