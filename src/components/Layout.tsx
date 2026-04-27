import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const Layout = () => (
  <div className="app-shell">
    <Sidebar />
    <main className="main"><Outlet /></main>
  </div>
);

export default Layout;
