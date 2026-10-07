// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

/**
 * An address that matches no screen (2026-10-07).
 *
 * Signed in, it used to `<Navigate to="/">` without a word — a broken link
 * looked like the app ignoring the click. It renders the not-found state now,
 * with "Go back". Signed out, every unknown address is still the sign-in.
 *
 * The REAL route table of App.tsx is rendered; only the providers and the two
 * eager screens around it are stubbed.
 */

const auth = vi.hoisted(() => ({ user: null as null | { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "en", t: (k: string) => t(k, "en") }) };
});
const stub = vi.hoisted(() => ({
  pass: ({ children }: { children?: ReactNode }) => children,
  none: () => null,
}));
vi.mock("@/components/NetworkBlockedScreen", () => ({ default: stub.none, useNetworkBlock: () => null }));
vi.mock("@/auth/AuthRouteReset", () => ({ default: stub.none }));
vi.mock("@/telemetry/TelemetryTracker", () => ({ default: stub.none }));
vi.mock("@/i18n/LanguageGates", () => ({ AccountLanguageGate: stub.pass }));
vi.mock("@/components/Layout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});
vi.mock("@/routes/BlockedBranchGuard", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});
vi.mock("@/components/UpdateReadyModal", () => ({ default: stub.none }));
vi.mock("@/components/UpdatesToast", () => ({ default: stub.none }));
vi.mock("@/notifications/NotificationsContext", () => ({ NotificationsProvider: stub.pass }));
vi.mock("@/support/SupportUnreadContext", () => ({ SupportUnreadProvider: stub.pass }));
vi.mock("@/realtime/AccessGuard", () => ({ default: stub.none }));
vi.mock("@/realtime/BranchVisibilityGuard", () => ({ default: stub.none }));
vi.mock("@/realtime/echo", () => ({ primeRealtimeConfig: async () => {} }));
vi.mock("@/realtime/useAppUpdates", () => ({ useAppUpdates: () => {}, useUpdateCatchUp: () => {} }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ UpdatesNotificationProvider: stub.pass }));
vi.mock("@/routes/Home", () => ({ default: () => <div>HOME-SCREEN</div> }));
vi.mock("@/routes/Login", () => ({ default: () => <div>LOGIN-SCREEN</div> }));

import App from "./App";

const open = async (hash: string) => {
  window.location.hash = hash;
  await act(async () => { render(<App />); });
};

beforeEach(() => { auth.user = null; });
afterEach(() => { cleanup(); window.location.hash = ""; });

describe("an unknown address", () => {
  test("signed in: the not-found state, not a silent jump to the dashboard", async () => {
    auth.user = { id: 1, role: "admin" };
    await open("#/no/such/screen");

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.getByText("It looks like this page no longer exists or the address is wrong.")).toBeTruthy();
    expect(screen.queryByText("HOME-SCREEN")).toBeNull();
    expect(window.location.hash).toBe("#/no/such/screen");
  });

  test("«Go back» on an address opened directly lands on the dashboard", async () => {
    auth.user = { id: 1, role: "admin" };
    await open("#/no/such/screen");

    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Go back" })); });
    expect(await screen.findByText("HOME-SCREEN")).toBeTruthy();
  });

  test("signed in, a signed-out screen's address is not «not found»: it is the dashboard", async () => {
    auth.user = { id: 1, role: "admin" };
    await open("#/forgot-password");

    expect(await screen.findByText("HOME-SCREEN")).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  test("signed out: still the sign-in, whatever the address", async () => {
    await open("#/no/such/screen");

    expect(await screen.findByText("LOGIN-SCREEN")).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  test("a known address still opens its screen", async () => {
    auth.user = { id: 1, role: "admin" };
    await open("#/");

    expect(await screen.findByText("HOME-SCREEN")).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });
});
