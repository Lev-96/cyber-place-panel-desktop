import { IAccountSwitchTarget } from "@/api/accountSwitch";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import SupportIcon from "@/components/ui/SupportIcon";
import { useSupportUnread } from "@/support/SupportUnreadContext";
import AccountSwitchModal from "@/components/profile/AccountSwitchModal";
import AccountSwitchPanel from "@/components/profile/AccountSwitchPanel";
import ProfileModal from "@/components/profile/ProfileModal";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/hooks/useAnchoredPopover";
import { NavLink, useNavigate } from "react-router-dom";

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

/** Which face of the account popover is showing. */
type MenuView = "menu" | "managers";

const UserMenu = ({ name, email, role, roleLabel }: UserCardProps) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const palette = paletteFor(role);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("menu");
  const [profileOpen, setProfileOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<IAccountSwitchTarget | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // Both company roles hand the machine over to a colleague: an owner to one of
  // his managers, a manager back to the owner or to another manager of the same
  // company. WHO is actually offered is decided by the backend — an admin has
  // no company, so no picker.
  const canSwitchAccount = role === "company_owner" || role === "manager";

  const closeMenu = () => { setOpen(false); setView("menu"); };

  /**
   * The popover is rendered into `document.body`, not next to the card.
   *
   * The sidebar clips its children so its nav can scroll, and the account
   * switcher is wider than the card it hangs off — so anchored inside the
   * sidebar, everything past its edge was cut off. In a portal it belongs to
   * the window, and `useAnchoredPopover` keeps it beside the card and inside
   * that window at any size or display scaling.
   */
  const cardRef = useRef<HTMLButtonElement>(null);
  const anchored = useAnchoredPopover(cardRef, open, view === "managers" ? 320 : 240);

  // Close the popover on an outside click or Escape. While a modal opened
  // FROM the popover is up, an outside click belongs to that modal.
  useEffect(() => {
    if (!open || switchTarget) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      // The popover lives in a portal, so it is NOT inside `ref` any more —
      // without checking it too, clicking the menu would close the menu.
      if (popRef.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, switchTarget]);

  return (
    <div ref={ref} style={{ position: "relative", margin: "0 8px 10px" }}>
      {open && anchored && createPortal(
        <div
          ref={popRef}
          className={`user-menu-pop${view === "managers" ? " is-wide" : ""}`}
          style={anchored.style}
        >
          {view === "menu" ? (
            <div className="user-menu-view">
              <button type="button" onClick={() => { closeMenu(); setProfileOpen(true); }}>{t("profile.title")}</button>
              <button type="button" onClick={() => { closeMenu(); navigate("/settings"); }}>{t("nav.settings")}</button>
              {canSwitchAccount && (
                <>
                  <span className="user-menu-sep" aria-hidden />
                  <button
                    type="button"
                    className="user-menu-switch"
                    onClick={() => setView("managers")}
                  >
                    <span className="user-menu-switch-icon" aria-hidden>⇄</span>
                    <span>{t("switchAccount.cta")}</span>
                    <span className="user-menu-switch-chevron" aria-hidden>›</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="user-menu-view">
              <AccountSwitchPanel
                onBack={() => setView("menu")}
                onPick={(account) => { setSwitchTarget(account); setOpen(false); }}
              />
            </div>
          )}
        </div>,
        document.body,
      )}

      <button
        ref={cardRef}
        type="button"
        className={`user-card${open ? " active" : ""}`}
        title={name}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          background:
            "linear-gradient(135deg, rgba(7, 221, 241, 0.06), rgba(209, 82, 250, 0.05))",
          border: "1px solid #1f2a44",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
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
      </button>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {switchTarget && (
        <AccountSwitchModal
          target={switchTarget}
          onClose={() => { setSwitchTarget(null); setView("menu"); }}
          onSwitched={() => { setSwitchTarget(null); closeMenu(); }}
        />
      )}
    </div>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const { unreadCount } = useNotifications();
  const { unread: supportUnread } = useSupportUnread();
  const { panel: panelUpd, agent: agentUpd } = useUpdatesNotification();
  const role = user?.role;

  // Badge counts: admin sees the union of panel + agent pending
  // promotes; owner/manager only ever see the agent count. Both stay
  // 0 when nothing is pending so the badge silently disappears.
  const adminUpdateCount =
    (panelUpd?.has_update ? 1 : 0) + (agentUpd?.has_update ? 1 : 0);
  const agentUpdateCount = agentUpd?.has_update ? 1 : 0;
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
      <nav className="sidebar-nav">
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
      {can(role, "menu.companies") && (
        <NavLink to="/companies">{t("nav.companies")}</NavLink>
      )}
      {can(role, "revenue.view") && (
        <NavLink to="/revenue">{t("nav.revenue")}</NavLink>
      )}
      {can(role, "menu.expenses") && (
        <NavLink to="/expenses">{t("nav.expenses")}</NavLink>
      )}
      {can(role, "menu.metrics") && (
        <NavLink to="/metrics">{t("nav.metrics")}</NavLink>
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
      {can(role, "menu.updates") && (
        <NavLink to="/settings/updates">
          {t("nav.updates")}
          <UnreadBadge count={adminUpdateCount} />
        </NavLink>
      )}
      {can(role, "menu.agentUpdates") && !can(role, "menu.updates") && (
        // Admin already sees both apps under /settings/updates;
        // owner+manager get this dedicated agent-only entry.
        <NavLink to="/settings/agent-updates">
          {t("nav.agentUpdates")}
          <UnreadBadge count={agentUpdateCount} />
        </NavLink>
      )}
      </nav>
      <div className="sidebar-footer">
        {/* Support is not another section of the product — it is the way out of
            a problem with it. So it reads as a card rather than a row: pinned to
            the bottom, its own surface, a line of explanation under the name.
            Somebody looking for help finds it without reading the menu. */}
        {can(role, "menu.support") && (
          <NavLink to="/support" className="nav-support-card">
            <span className="nav-support-card__icon" aria-hidden>
              <SupportIcon size={18} />
            </span>
            <span className="nav-support-card__text">
              <span className="nav-support-card__title">{t("nav.support")}</span>
              <span className="nav-support-card__hint">{t("nav.supportHint")}</span>
            </span>
            <UnreadBadge count={supportUnread} />
          </NavLink>
        )}

        <UserMenu
          name={user?.name}
          email={user?.email}
          role={role}
          roleLabel={role ? t(`role.${role}`) || role.replace("_", " ") : ""}
        />
        <button className="logout" onClick={() => void logout()}>
          {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
