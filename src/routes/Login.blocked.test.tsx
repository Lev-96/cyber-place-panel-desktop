// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * What a blocked operator reads when they try to sign in.
 *
 * The refusal is a 403 carrying a machine-readable `code`; the panel renders
 * its OWN sentence from that code. Before this, the login screen showed the
 * server's string verbatim — so a panel switched to Russian greeted a blocked
 * manager with "Your branch has been blocked. Please contact the
 * administrator." That is the case these tests hold shut.
 */

const auth = vi.hoisted(() => ({ login: vi.fn(async () => {}) }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "ru", setLang: () => {} }),
}));
vi.mock("@/auth/recentEmails", () => ({
  recentEmails: { list: async () => [], forget: async () => {}, remember: async () => {} },
}));
vi.mock("@/components/login/HudBackdrop", () => ({ default: () => null }));
vi.mock("@/components/login/ForgotPasswordForm", () => ({ default: () => null }));
// The WebGL backdrop is decorative and pulls in three.js, which needs a
// ResizeObserver jsdom does not have. Nothing about a refusal message depends
// on it.
vi.mock("@/components/login/LoginScene", () => ({ default: () => null }));

import Login from "./Login";

const apiError = (status: number, body: unknown) =>
  Object.assign(new Error("Your branch has been blocked. Please contact the administrator."), { status, body });

const submit = async () => {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Login />
    </MemoryRouter>,
  );
  const form = document.querySelector("form");
  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
};

afterEach(() => {
  cleanup();
  auth.login.mockReset();
});

describe("a blocked sign-in", () => {
  test("is explained in the panel's language, not the server's", async () => {
    auth.login.mockRejectedValue(
      apiError(403, {
        message: "Your branch has been blocked. Please contact the administrator.",
        code: "branch_blocked",
        scope: "branch",
      }),
    );

    await submit();

    await waitFor(() => expect(screen.getByText("blocking.reason.branch_blocked")).toBeTruthy());
  });

  test("names the company when the company is what closed them", async () => {
    auth.login.mockRejectedValue(apiError(403, { code: "company_blocked", scope: "company" }));

    await submit();

    await waitFor(() => expect(screen.getByText("blocking.reason.company_blocked")).toBeTruthy());
  });

  test("a wrong password is still just a wrong password", async () => {
    auth.login.mockRejectedValue(apiError(422, { message: "Invalid password" }));

    await submit();

    await waitFor(() => expect(screen.getByText("login.invalidCredentials")).toBeTruthy());
  });

  test("an unrelated failure keeps showing what the server said", async () => {
    auth.login.mockRejectedValue(
      Object.assign(new Error("Service unavailable"), { status: 503, body: { message: "Service unavailable" } }),
    );

    await submit();

    await waitFor(() => expect(screen.getByText("Service unavailable")).toBeTruthy());
  });
});
