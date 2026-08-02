import { AuthProvider } from "@/auth/AuthContext";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { FirstRunLanguageGate } from "@/i18n/LanguageGates";
import "@/styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// Currency uses static rates (no live FX fetch): prices are stored in
// AMD and converted through the fixed table in currency.ts. The display
// currency defaults to AMD and only changes via Settings.
//
// FirstRunLanguageGate sits ABOVE AuthProvider on purpose: a fresh install must
// choose its language before it sees a login form (and before /user/me is even
// requested), so nobody is asked to sign in through an interface they can't
// read. Once a language has been chosen the gate is a pass-through forever.
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <FirstRunLanguageGate>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FirstRunLanguageGate>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
