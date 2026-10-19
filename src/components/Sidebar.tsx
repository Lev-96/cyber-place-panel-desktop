import { IAccountSwitchTarget } from "@/api/accountSwitch";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import NavIcon from "@/components/ui/NavIcon";
import SupportIcon from "@/components/ui/SupportIcon";
import { useSupportUnread } from "@/support/SupportUnreadContext";
import AccountSwitchModal from "@/components/profile/AccountSwitchModal";
import AccountSwitchPanel from "@/components/profile/AccountSwitchPanel";
import ProfileModal from "@/components/profile/ProfileModal";
import { useLang } from "@/i18n/LanguageContext";
import { activeNavTo, sortedNavItems, withStaffMenu } from "@/components/sidebarNav";
import { useNotifications } from "@/notifications/NotificationsContext";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/hooks/useAnchoredPopover";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

const UnreadBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span
      className="unread-badge"
      aria-label={`${count} unread`}
      style={{
        display: "inline-block",
        flexShrink: 0,
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
  /** Drawn inside the account card, right of the clickable part (sign-out). */
  trailing?: ReactNode;
}

/** Which face of the account popover is showing. */
type MenuView = "menu" | "managers";

const UserMenu = ({ name, email, role, roleLabel, trailing }: UserCardProps) => {
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
    // The account card: the same surface, edge and width as the Support card
    // above it. The clickable part opens the account menu; the trailing slot
    // (sign-out) sits on its right, so the card is the last row of the sidebar.
    <div ref={ref} className="sidebar-account">
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
      >
        <div
          aria-hidden
          style={{
            // Same 34px as Support's icon tile, so both cards' titles line up.
            width: 34,
            height: 34,
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
            {name || "-"}
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

      {trailing}

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

interface SidebarProps {
  /**
   * Extra entries for the pinned footer, drawn under Support and above the
   * account card. The desktop passes nothing; the owner web puts its
   * "Telegram access" card here (2026-09-29), so a shell can add its own
   * entry without a second menu.
   */
  footerExtra?: ReactNode;
}

const Sidebar = ({ footerExtra }: SidebarProps = {}) => {
  const { user, logout } = useAuth();
  const { t, lang } = useLang();
  const { pathname } = useLocation();
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
  const dash = user?.dashboard;
  const myBranchId = typeof dash?.branch_id === "number" ? dash.branch_id : null;
  // The owner's company (single company per owner, as everywhere in the panel).
  const myCompanyId = typeof dash?.company_id === "number" ? dash.company_id : null;

  // Every entry this role may open: the Dashboard pinned first (2026-10-09);
  // for an owner or a manager their explicit order and menu labels next
  // (withStaffMenu, 2026-10-11); the rest in alphabetical order of the label
  // in the current language (2026-10-07) — re-sorted when the language changes.
  const navItems = sortedNavItems(
    withStaffMenu([
      { to: "/", labelKey: "nav.dashboard", end: true, show: true, pinnedFirst: true },
      // Creating a branch is an action on the Branches page (its header
      // button), not an entry in the navigation.
      { to: "/branches", labelKey: "nav.branches", show: can(role, "menu.branches") },
      {
        to: `/branches/${myBranchId}`,
        labelKey: "nav.myBranch",
        show: role === "manager" && myBranchId !== null,
      },
      { to: "/branches-map", labelKey: "nav.map", show: can(role, "menu.map") },
      { to: "/bookings", labelKey: "nav.bookings", show: true },
      { to: "/bookings/confirm", labelKey: "nav.scan", show: can(role, "menu.scan") },
      { to: "/tournaments", labelKey: "nav.tournaments", show: can(role, "menu.tournaments") },
      { to: "/games", labelKey: "nav.games", show: can(role, "menu.games") },
      { to: "/companies", labelKey: "nav.companies", show: can(role, "menu.companies") },
      { to: "/revenue", labelKey: "nav.revenue", show: can(role, "revenue.view") },
      { to: "/shifts", labelKey: "nav.shifts", show: can(role, "shift.manage") },
      { to: "/expenses", labelKey: "nav.expenses", show: can(role, "menu.expenses") },
      { to: "/metrics", labelKey: "nav.metrics", show: can(role, "menu.metrics") },
      {
        // Straight to the company's own page, the way "My branch" links to the
        // branch. `/my-company` only redirects, and a link to a route that only
        // redirects is never the current page — so it never lit up. Prefix
        // matching now covers the company's branches and revenue pages too.
        // An owner with no company still goes to `/my-company`, which is where
        // that is explained.
        to: myCompanyId !== null ? `/companies/${myCompanyId}` : "/my-company",
        labelKey: "nav.myCompany",
        show: can(role, "menu.myCompany"),
      },
      { to: "/managers", labelKey: "nav.managers", show: can(role, "menu.managers") },
      { to: "/owners", labelKey: "nav.owners", show: can(role, "owner.view") },
      { to: "/security", labelKey: "nav.security", show: can(role, "menu.security") },
      {
        to: "/notifications",
        labelKey: "nav.notifications",
        show: true,
        badge: <UnreadBadge count={unreadCount} />,
      },
      { to: "/settings", labelKey: "nav.settings", show: true },
      {
        to: "/settings/updates",
        labelKey: "nav.updates",
        show: can(role, "menu.updates"),
        badge: <UnreadBadge count={adminUpdateCount} />,
      },
      {
        // Admin already sees both apps under /settings/updates;
        // owner+manager get this dedicated agent-only entry.
        to: "/settings/agent-updates",
        labelKey: "nav.agentUpdates",
        show: can(role, "menu.agentUpdates") && !can(role, "menu.updates"),
        badge: <UnreadBadge count={agentUpdateCount} />,
      },
    ], role),
    t,
    lang,
  );
  // Exactly one entry is current: the most specific route containing the page
  // (`/bookings/confirm` is Scan, not Scan AND Bookings). Plain `Link`s, because
  // a NavLink decides on its own and two of them can both claim the page.
  const activeTo = activeNavTo(navItems, pathname);

  return (
    <aside className="sidebar">
      {/* Brand row — logo + wordmark. The logo PNG lives in /public,
          so Vite serves it at the root path in both dev and the built
          electron bundle. Height-limited to keep the header compact;
          the wordmark wraps onto its own line on a narrow sidebar. */}
      <h1
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <img
          src="./logo.png"
          alt=""
          aria-hidden
          style={{
            // The mark is 1.64:1, so the height is fixed and the width
            // follows; 24px keeps it and the wordmark on one 192px row.
            width: "auto",
            height: 24,
            flexShrink: 0,
          }}
        />
        <span>CYBER PLACE</span>
      </h1>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = item.to === activeTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <NavIcon id={item.id} />
              <span className="nav-label">{item.label}</span>
              {item.badge}
            </Link>
          );
        })}
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

        {footerExtra}

        <UserMenu
          name={user?.name}
          email={user?.email}
          role={role}
          roleLabel={role ? t(`role.${role}`) || role.replace("_", " ") : ""}
          trailing={
            <button
              type="button"
              className="logout"
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
              onClick={() => void logout()}
            >
              <NavIcon id="nav.signOut" />
            </button>
          }
        />
      </div>
    </aside>
  );
};

export default Sidebar;
