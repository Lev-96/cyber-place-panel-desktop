import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import { NavLink } from "react-router-dom";

const UnreadBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      style={{
        marginLeft: 8,
        display: "inline-block",
        minWidth: 20,
        padding: "1px 6px",
        borderRadius: 999,
        background: "#ef4444",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: "16px",
        textAlign: "center",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

/**
 * Visual identity tokens per role — gradient drives the avatar fill,
 * the chip uses the same hue at lower opacity. Centralised so adding
 * a role anywhere in the app can plug into the same palette.
 */
const ROLE_PALETTE: Record<string, { gradient: string; chipBg: string; chipFg: string; chipBorder: string }> = {
  admin: {
    gradient: "linear-gradient(135deg, #07ddf1, #06b6d4)",
    chipBg: "rgba(7, 221, 241, 0.14)",
    chipFg: "#07ddf1",
    chipBorder: "rgba(7, 221, 241, 0.45)",
  },
  company_owner: {
    gradient: "linear-gradient(135deg, #d152fa, #a855f7)",
    chipBg: "rgba(209, 82, 250, 0.14)",
    chipFg: "#d152fa",
    chipBorder: "rgba(209, 82, 250, 0.45)",
  },
  manager: {
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    chipBg: "rgba(34, 197, 94, 0.14)",
    chipFg: "#22c55e",
    chipBorder: "rgba(34, 197, 94, 0.45)",
  },
};

const NEUTRAL_PALETTE = {
  gradient: "linear-gradient(135deg, #6b7280, #4b5563)",
  chipBg: "rgba(148, 163, 184, 0.14)",
  chipFg: "#94a3b8",
  chipBorder: "rgba(148, 163, 184, 0.4)",
};

const paletteFor = (role: string | undefined) =>
  (role && ROLE_PALETTE[role]) || NEUTRAL_PALETTE;

/**
 * Two-letter avatar initials. Picks the first letter of the first
 * and last whitespace-separated tokens, so "John Smith" reads "JS"
 * while a single-word "Admin" reduces to "AD" — never empty.
 */
const initialsFor = (name: string | undefined): string => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
};

interface UserCardProps {
  name: string | undefined;
  email: string | undefined;
  role: string | undefined;
  roleLabel: string;
}

const UserCard = ({ name, email, role, roleLabel }: UserCardProps) => {
  const palette = paletteFor(role);
  return (
    <div
      style={{
        margin: "0 8px 10px",
        padding: "10px 12px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg, rgba(7, 221, 241, 0.06), rgba(209, 82, 250, 0.05))",
        border: "1px solid #1f2a44",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: palette.gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#020514",
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: 0.5,
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
        }}
      >
        {initialsFor(name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#e5e7eb",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
          }}
          title={name}
        >
          {name || "—"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2,
          }}
          title={email}
        >
          {email}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 6,
            padding: "1px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            background: palette.chipBg,
            color: palette.chipFg,
            border: `1px solid ${palette.chipBorder}`,
          }}
        >
          {roleLabel}
        </span>
      </div>
    </div>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const { unreadCount } = useNotifications();
  const role = user?.role;
  const dash = (user?.dashboard ?? {}) as { branch_id?: number | null };
  const myBranchId = typeof dash.branch_id === "number" ? dash.branch_id : null;

  return (
    <aside className="sidebar">
      {/* Brand row — logo + wordmark. The logo PNG lives in /public,
          so Vite serves it at the root path in both dev and the built
          electron bundle. Width-limited to keep the header compact;
          the wordmark wraps onto its own line on a narrow sidebar. */}
      <h1
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 8px 16px",
        }}
      >
        <img
          src="./logo.png"
          alt=""
          aria-hidden
          style={{
            width: 28,
            height: 28,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
        <span>CYBER PLACE</span>
      </h1>
      <NavLink to="/" end>
        {t("nav.dashboard")}
      </NavLink>
      {can(role, "menu.branches") && (
        <NavLink to="/branches">{t("nav.branches")}</NavLink>
      )}
      {role === "manager" && myBranchId !== null && (
        <NavLink to={`/branches/${myBranchId}`}>{t("nav.myBranch")}</NavLink>
      )}
      {can(role, "menu.map") && (
        <NavLink to="/branches-map">{t("nav.map")}</NavLink>
      )}
      <NavLink to="/bookings">{t("nav.bookings")}</NavLink>
      {can(role, "menu.scan") && (
        <NavLink to="/bookings/confirm">{t("nav.scan")}</NavLink>
      )}
      {can(role, "menu.tournaments") && (
        <NavLink to="/tournaments">{t("nav.tournaments")}</NavLink>
      )}
      {can(role, "menu.games") && (
        <NavLink to="/games">{t("nav.games")}</NavLink>
      )}
      {can(role, "menu.servicesAdmin") && (
        <NavLink to="/services-admin">{t("nav.services")}</NavLink>
      )}
      {can(role, "menu.companies") && (
        <NavLink to="/companies">{t("nav.companies")}</NavLink>
      )}
      {can(role, "revenue.view") && (
        <NavLink to="/revenue">{t("nav.revenue")}</NavLink>
      )}
      {can(role, "menu.myCompany") && (
        <NavLink to="/my-company">{t("nav.myCompany")}</NavLink>
      )}
      {can(role, "menu.managers") && (
        <NavLink to="/managers">{t("nav.managers")}</NavLink>
      )}
      <NavLink to="/notifications">
        {t("nav.notifications")}
        <UnreadBadge count={unreadCount} />
      </NavLink>
      <NavLink to="/settings">{t("nav.settings")}</NavLink>
      <div className="spacer" />
      <UserCard
        name={user?.name}
        email={user?.email}
        role={role}
        roleLabel={role ? t(`role.${role}`) || role.replace("_", " ") : ""}
      />
      <button className="logout" onClick={() => void logout()}>
        {t("nav.signOut")}
      </button>
    </aside>
  );
};

export default Sidebar;
