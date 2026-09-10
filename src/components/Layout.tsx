import { Outlet } from "react-router-dom";
import ExpenseReminderNotifier from "./notifications/ExpenseReminderNotifier";
import GlobalBookingNotifier from "./notifications/GlobalBookingNotifier";
import SessionEndingNotifier from "./notifications/SessionEndingNotifier";
import SupportNotifier from "./notifications/SupportNotifier";
import { Ps5ControlProvider } from "@/ps5/Ps5ControlProvider";
import UnexpectedWakeDialog from "./ps5/UnexpectedWakeDialog";
import Sidebar from "./Sidebar";
import BackButton from "./ui/BackButton";

const Layout = () => (
  /*
    The console watcher wraps the whole shell, not one screen. Detecting a
    console somebody switched on by hand cannot depend on which page is open —
    that is precisely how an owner ended up never being asked.
  */
  <Ps5ControlProvider>
  <div className="app-shell">
    <Sidebar />
    <main className="main">
      <BackButton />
      <Outlet />
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
    {/* Owner-only, and silent for everyone else: it renders nothing unless the
        signed-in role holds `branch.places` AND a console in their own venue
        has woken with no session on it. Mounted here so the question reaches
        them whatever screen they are on. */}
    <UnexpectedWakeDialog />
    {/*
      Admin-only recurring-service payment reminder. Polls the "due
      within 3 days" feed and rings (chime + OS push + corner toast) the
      first time a service enters the window. Non-admins render nothing.
    */}
    <ExpenseReminderNotifier />
  </div>
  </Ps5ControlProvider>
);

export default Layout;
