import { AuthProvider } from "@/auth/AuthContext";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { FxRatesProvider } from "@/i18n/FxRatesContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import "@/styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// FxRatesProvider wraps LanguageProvider so the latter can subscribe
// to FX-version bumps via useFxRates() — that's what makes the
// `money()` helper returned from useLang() re-create on every rate
// refresh, which in turn re-renders all 30+ price displays across
// the panel (revenue, member balances, session receipts, etc.) the
// moment today's rates land from the public API.
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <FxRatesProvider>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </FxRatesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
