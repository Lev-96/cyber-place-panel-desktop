import NavIcon from "@/components/ui/NavIcon";
import { useLang } from "@/i18n/LanguageContext";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Folding the side menu to an icon rail (2026-11-03). The desktop shell owns
 * one flag; the menu reads it (tooltips on its entries while folded) and the
 * top bar draws the one toggle. Outside the desktop shell (the owner web
 * renders the same Sidebar in a drawer of its own) there is no provider, so
 * nothing here applies.
 *
 * Not remembered on purpose: the panel opens with the menu shown on every
 * launch and sign-in. It holds across screens, because the shell stays mounted.
 */

/** The menu's element id, for the toggle's `aria-controls`. */
export const SIDEBAR_ID = "app-sidebar";

interface SidebarCollapse {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapse | null>(null);

/** The shell's menu state, or `null` outside the desktop shell. */
export const useSidebarCollapse = (): SidebarCollapse | null => useContext(SidebarCollapseContext);

/**
 * The shell's grid. Its children come from `Layout` already built, so flipping
 * the flag re-renders this element and the two readers above — never the
 * screen, the notifiers or the PS5 watcher, which are not even re-rendered.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  // Functional update: two quick presses are two flips, never a stale one.
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return (
    <SidebarCollapseContext.Provider value={value}>
      <div className={`app-shell app-shell--collapsible${collapsed ? " is-sidebar-collapsed" : ""}`}>
        {children}
      </div>
    </SidebarCollapseContext.Provider>
  );
};

/**
 * The one control, in the top bar's left slot: it never moves out from under
 * the pointer or the keyboard focus, whichever way the menu goes. The name is
 * the thing it controls; the tooltip says what a press does now.
 */
export const SidebarToggle = () => {
  const state = useSidebarCollapse();
  const { t } = useLang();
  if (!state) return null;
  const { collapsed, toggle } = state;

  return (
    <button
      type="button"
      className="cp-sidebar-toggle"
      data-testid="sidebar-toggle"
      aria-controls={SIDEBAR_ID}
      aria-expanded={!collapsed}
      aria-label={t("nav.sideMenu")}
      title={t(collapsed ? "nav.menuShow" : "nav.menuHide")}
      onClick={toggle}
    >
      <NavIcon id={collapsed ? "nav.menuShow" : "nav.menuHide"} />
    </button>
  );
};
