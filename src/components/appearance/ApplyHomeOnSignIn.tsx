import { useAuth } from "@/auth/AuthContext";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Open the person's chosen first screen (2026-10-27) — once, when they sign
 * in (or the app starts) on the dashboard. Later visits to the dashboard are
 * the person's own and are left alone; a launch that restored another screen
 * stays there. The route is one of the panel's own (`/…`, checked when the
 * preference was read), and its screen still asks its own permission: a home
 * the person may not open shows the usual refusal, never someone else's data.
 */
const ApplyHomeOnSignIn = () => {
  const ui = useUiPreferencesOptional();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Whose sign-in has been handled: a switch to another account on the same
  // machine (no remount) is a new sign-in and gets that person's first screen.
  const handledFor = useRef<number | null>(null);
  const home = ui?.layout.home ?? null;
  const loaded = ui?.loaded ?? false;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null || handledFor.current === userId || !loaded) return;
    handledFor.current = userId;
    if (home && home !== "/" && pathname === "/") navigate(home, { replace: true });
  }, [userId, loaded, home, pathname, navigate]);

  return null;
};

export default ApplyHomeOnSignIn;
