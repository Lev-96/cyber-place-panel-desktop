import type { ReactNode } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { BranchScopeContext } from "@/components/ui/state";
import ExpenseReminderNotifier from "./notifications/ExpenseReminderNotifier";
import GlobalBookingNotifier from "./notifications/GlobalBookingNotifier";
import SessionEndingNotifier from "./notifications/SessionEndingNotifier";
import SessionReminderNotifier from "./notifications/SessionReminderNotifier";
import BillingNoticeNotifier from "./notifications/BillingNoticeNotifier";
import PanelUpdateNotifier from "./notifications/PanelUpdateNotifier";
import DueConfirmNotifier from "./notifications/DueConfirmNotifier";
import TimeBonusNotifier from "@/components/notifications/TimeBonusNotifier";
import RatePlayerNotifier from "@/components/notifications/RatePlayerNotifier";
import ClubRatedNotifier from "@/components/notifications/ClubRatedNotifier";
import OpenBillsNotifier from "./notifications/OpenBillsNotifier";
import SupportNotifier from "./notifications/SupportNotifier";
import { Ps5ControlProvider } from "@/ps5/Ps5ControlProvider";
import Sidebar from "./Sidebar";
import RouteErrorBoundary from "./errors/RouteErrorBoundary";
import { AppShell } from "./SidebarCollapse";
import PageTopBar from "./ui/PageTopBar";
import UnsavedInterfaceNotice from "./appearance/UnsavedInterfaceNotice";
import NewInterfacesOffer from "./appearance/NewInterfacesOffer";

/** The screen on display is one branch's (`/branches/:id/…`): a 403 there is "not your branch". */
const BranchScope = ({ children }: { children: ReactNode }) => (
  <BranchScopeContext.Provider value={useMatch("/branches/:branchId/*") !== null}>
    {children}
  </BranchScopeContext.Provider>
);

const Layout = () => (
  /*
    The console watcher wraps the whole shell, not one screen. Detecting a
    console somebody switched on by hand cannot depend on which page is open —
    that is precisely how an owner ended up never being asked.
  */
  <Ps5ControlProvider>
  {/* The shell's grid, which can hide the side menu (2026-11-03). */}
  <AppShell>
    <Sidebar />
    <main className="main">
      <PageTopBar />
      {/* Interface edits left unsaved, said wherever the person went (2026-10-27). */}
      <UnsavedInterfaceNotice />
      <NewInterfacesOffer />
      {/* A screen that throws is caught here: the menu stays usable (B2). */}
      <RouteErrorBoundary>
        <BranchScope>
          <Outlet />
        </BranchScope>
      </RouteErrorBoundary>
    </main>
    {/*
      App-shell-level toast for booking lifecycle events. Lives outside
      <main> so it can position itself anywhere on screen and stays
      mounted across route changes — the cashier sees a new booking
      regardless of which page they're currently looking at.
    */}
    <GlobalBookingNotifier />
    <SupportNotifier />
    <SessionEndingNotifier />
    {/* A seat paid ahead ended owing more: how was it paid? (2026-11-20) */}
    <DueConfirmNotifier />
    <TimeBonusNotifier />
    {/* After a visit with a Club Card the club rates the player (2026-11-27). */}
    <RatePlayerNotifier />
    {/* A player's rating of the club arriving: heard and shown by the OS (2026-11-27). */}
    <ClubRatedNotifier />
    {/* Final bills hidden to close later, until a payment closes them (2026-11-22). */}
    <OpenBillsNotifier />
    {/* A reminder a player asked for has rung (2026-11-15, the server's notification). */}
    <SessionReminderNotifier />
    {/* A platform payment notice arriving rings and raises an OS notification (2026-11-09). */}
    <BillingNoticeNotifier />
    {/* A new desktop version, said where it is seen, with a way to it (2026-11-20). */}
    <PanelUpdateNotifier />
    {/*
      Admin-only recurring-service payment reminder. Polls the "due
      within 3 days" feed and rings (chime + OS push + corner toast) the
      first time a service enters the window. Non-admins render nothing.
    */}
    <ExpenseReminderNotifier />
  </AppShell>
  </Ps5ControlProvider>
);

export default Layout;
