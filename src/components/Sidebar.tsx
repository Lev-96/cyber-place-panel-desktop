import { useAuth } from "@/auth/AuthContext";
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside className="sidebar">
      <h1>CYBERPLACE</h1>
      <NavLink to="/" end>Dashboard</NavLink>
      <NavLink to="/branches">Branches</NavLink>
      {isAdmin && <NavLink to="/companies">Companies</NavLink>}
      <div className="spacer" />
      <div style={{ padding: "0 8px", fontSize: 12, color: "#94a3b8" }}>
        {user?.name}
        <div style={{ fontSize: 11 }}>{user?.email}</div>
      </div>
      <button className="logout" onClick={() => void logout()}>Sign out</button>
    </aside>
  );
};

export default Sidebar;
