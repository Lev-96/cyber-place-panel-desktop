import { AuthProvider } from "@/auth/AuthContext";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import "@/styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
