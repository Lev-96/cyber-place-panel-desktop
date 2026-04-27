import { AuthProvider } from "@/auth/AuthContext";
import App from "@/App";
import "@/styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
