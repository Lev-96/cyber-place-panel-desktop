import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const role = user?.role;

  return (
    <aside className="sidebar">
      <h1>CYBER PLACE</h1>
      <NavLink to="/" end>{t("nav.dashboard")}</NavLink>
      {can(role, "menu.branches")      && <NavLink to="/branches">{t("nav.branches")}</NavLink>}
      {can(role, "menu.map")           && <NavLink to="/branches-map">{t("nav.map")}</NavLink>}
      <NavLink to="/bookings">{t("nav.bookings")}</NavLink>
      {can(role, "menu.scan")          && <NavLink to="/bookings/confirm">{t("nav.scan")}</NavLink>}
      {can(role, "menu.tournaments")   && <NavLink to="/tournaments">{t("nav.tournaments")}</NavLink>}
      {can(role, "menu.games")         && <NavLink to="/games">{t("nav.games")}</NavLink>}
      {can(role, "menu.servicesAdmin") && <NavLink to="/services-admin">{t("nav.services")}</NavLink>}
      {can(role, "menu.companies")     && <NavLink to="/companies">{t("nav.companies")}</NavLink>}
      {can(role, "menu.companies")     && <NavLink to="/revenue">Revenue</NavLink>}
      {can(role, "menu.myCompany")     && <NavLink to="/my-company">My company</NavLink>}
      {can(role, "menu.managers")      && <NavLink to="/managers">{t("nav.managers")}</NavLink>}
      <NavLink to="/notifications">{t("nav.notifications")}</NavLink>
      <NavLink to="/settings">{t("nav.settings")}</NavLink>
      <div className="spacer" />
      <div style={{ padding: "0 8px", fontSize: 12, color: "#94a3b8" }}>
        {user?.name}
        <div style={{ fontSize: 11 }}>{user?.email}</div>
        <div style={{ fontSize: 11, color: "#07ddf1" }}>{role}</div>
      </div>
      <button className="logout" onClick={() => void logout()}>{t("nav.signOut")}</button>
    </aside>
  );
};

export default Sidebar;
