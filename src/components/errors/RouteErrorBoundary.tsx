import ErrorBoundary, { type CaughtCrash } from "@/components/ErrorBoundary";
import Button from "@/components/ui/Button";
import { StateView } from "@/components/ui/state";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * One screen failing is one screen failing (B2, audit 2026-11-13).
 *
 * Wraps the layout's `<Outlet />`: the side menu and the top bar are outside
 * it and keep working. Keyed on the pathname, so picking any other menu entry
 * leaves the crash behind; «Home» does the same for the home screen.
 */
const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} fallback={(crash) => <ScreenCrashed crash={crash} />}>
      {children}
    </ErrorBoundary>
  );
};

const COPIED_FOR_MS = 2000;

const ScreenCrashed = ({ crash }: { crash: CaughtCrash }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(crash.report);
      setCopied(true);
    } catch { /* clipboard refused: the screen still offers Home */ }
  };

  return (
    <StateView
      variant="error"
      titleKey="crash.screen.title"
      descriptionKey="crash.screen.description"
      actions={(
        <>
          <Button
            onClick={() => {
              // Leaving the route resets the boundary through its key. Already
              // on «/» (the home screen itself crashed), the key cannot change,
              // so it is tried again explicitly. Resetting BEFORE the route
              // changed would re-render the screen that just failed.
              if (pathname === "/") crash.reset();
              else navigate("/");
            }}
          >
            {t("crash.screen.home")}
          </Button>
          <Button variant="secondary" onClick={() => void copy()} aria-live="polite">
            {t(copied ? "crash.screen.copied" : "crash.screen.copy")}
          </Button>
        </>
      )}
    />
  );
};

export default RouteErrorBoundary;
