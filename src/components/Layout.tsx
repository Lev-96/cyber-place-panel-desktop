import { Outlet } from "react-router-dom";
import GlobalBookingNotifier from "./notifications/GlobalBookingNotifier";
import Sidebar from "./Sidebar";
import BackButton from "./ui/BackButton";

const Layout = () => (
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
  </div>
);

export default Layout;
