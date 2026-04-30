import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BackButton from "./ui/BackButton";

const Layout = () => (
  <div className="app-shell">
    <Sidebar />
    <main className="main">
      <BackButton />
      <Outlet />
    </main>
  </div>
);

export default Layout;
