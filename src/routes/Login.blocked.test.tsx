// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const auth = vi.hoisted(() => ({ login: vi.fn(async (_email: string, _password: string) => {}) }));
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
// The mosaic itself has its own tests; here it is a dialog with a "solved" button.
vi.mock("@/components/login/CaptchaDialog", () => ({
  default: ({ open, onSolved }: { open: boolean; onSolved: (t: string) => void }) =>
    open ? <button type="button" onClick={() => onSolved("pass-1")}>solve-mosaic</button> : null,
}));

import { loginChallenge } from "@/auth/loginChallenge";
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

describe("too many wrong passwords on the desktop (2026-10-07)", () => {
  test("a lock is a countdown from the server's seconds, and the button waits", async () => {
    auth.login.mockRejectedValue(apiError(423, { message: "Вход закрыт ещё на 50 мин.", code: "login_locked", retry_after: 3000 }));

    await submit();

    await waitFor(() => expect(screen.getByText("login.hold.locked")).toBeTruthy());
    expect(screen.getByText("login.hold.retryIn")).toBeTruthy();
    // Not the server's fixed "50 more minutes" sentence, and not "wrong password".
    expect(screen.queryByText("Вход закрыт ещё на 50 мин.")).toBeNull();
    expect(screen.queryByText("login.invalidCredentials")).toBeNull();
    expect((screen.getByRole("button", { name: "login.title" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("the per-minute limit is a countdown too", async () => {
    auth.login.mockRejectedValue(apiError(429, { message: "Too many", code: "too_many_attempts", retry_after: 42 }));

    await submit();

    await waitFor(() => expect(screen.getByText("login.hold.throttled")).toBeTruthy());
  });

  test("another email is the server's to judge: typing one lifts the countdown", async () => {
    auth.login.mockRejectedValue(apiError(423, { code: "login_locked", retry_after: 3000 }));
    await submit();
    await waitFor(() => expect(screen.getByText("login.hold.locked")).toBeTruthy());

    fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "other@club.am" } });

    expect(screen.queryByText("login.hold.locked")).toBeNull();
    expect((screen.getByRole("button", { name: "login.title" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("the tenth wrong password is still just a wrong password", async () => {
    auth.login.mockRejectedValue(apiError(422, { errors: { email: ["…"] }, code: "reset_suggested" }));

    await submit();

    await waitFor(() => expect(screen.getByText("login.invalidCredentials")).toBeTruthy());
  });

  // The bug of 2026-10-07: solving the mosaic re-sent the same wrong
  // credentials by itself, which failed and opened the next mosaic at once.
  test("solving the mosaic goes back to the form and sends nothing by itself", async () => {
    auth.login.mockRejectedValueOnce(apiError(422, { errors: { password: ["…"] }, code: "captcha_required" }));

    await submit();
    await waitFor(() => expect(screen.getByText("solve-mosaic")).toBeTruthy());
    expect(screen.getByText("login.invalidCredentials")).toBeTruthy();

    fireEvent.click(screen.getByText("solve-mosaic"));

    expect(screen.queryByText("solve-mosaic")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("login.captchaPassed");
    // No automatic sign-in, so no second mosaic; the form is open.
    await new Promise((r) => setTimeout(r, 20));
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("solve-mosaic")).toBeNull();
    expect((screen.getByRole("button", { name: "login.title" }) as HTMLButtonElement).disabled).toBe(false);
    // The email is empty here, so the cursor goes there first.
    expect(document.activeElement).toBe(document.querySelector('input[type="email"]'));
    loginChallenge.take();
  });

  test("after the mosaic the corrected credentials go once, with the pass", async () => {
    auth.login.mockRejectedValueOnce(apiError(422, { errors: { password: ["…"] }, code: "captcha_required" }));
    await submit();
    fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "op@club.am" } });
    await waitFor(() => expect(screen.getByText("solve-mosaic")).toBeTruthy());
    fireEvent.click(screen.getByText("solve-mosaic"));
    // The email is filled: the cursor is in the password, ready to be retyped.
    expect(document.activeElement).toBe(document.querySelector('input[type="password"]'));

    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: "right-one" } });
    const sent: Array<[string, string, string | null]> = [];
    auth.login.mockImplementationOnce(async (email: string, password: string) => { sent.push([email, password, loginChallenge.take()]); });
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(2));
    expect(sent).toEqual([["op@club.am", "right-one", "pass-1"]]);
    expect(screen.queryByText("login.captchaPassed")).toBeNull();
  });

  test("a new mosaic opens only when the server asks for it again", async () => {
    auth.login.mockRejectedValueOnce(apiError(422, { errors: { password: ["…"] }, code: "captcha_required" }));
    await submit();
    await waitFor(() => expect(screen.getByText("solve-mosaic")).toBeTruthy());
    fireEvent.click(screen.getByText("solve-mosaic"));
    expect(screen.queryByText("solve-mosaic")).toBeNull();

    // Still the wrong password: the server answers captcha_required, and only now the next mosaic.
    auth.login.mockRejectedValueOnce(apiError(422, { errors: { password: ["…"] }, code: "captcha_required" }));
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.getByText("solve-mosaic")).toBeTruthy());
    expect(screen.getByText("login.invalidCredentials")).toBeTruthy();
    expect(screen.queryByText("login.captchaPassed")).toBeNull();
  });

  test("a lock after the mosaic is still the countdown", async () => {
    auth.login.mockRejectedValueOnce(apiError(422, { errors: { password: ["…"] }, code: "captcha_required" }));
    await submit();
    await waitFor(() => expect(screen.getByText("solve-mosaic")).toBeTruthy());
    fireEvent.click(screen.getByText("solve-mosaic"));

    auth.login.mockRejectedValueOnce(apiError(423, { code: "login_locked", retry_after: 3000 }));
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.getByText("login.hold.locked")).toBeTruthy());
    expect(screen.queryByText("login.captchaPassed")).toBeNull();
    loginChallenge.take();
  });

  test("a sign-in held back for the mosaic (428) opens it without calling the password wrong", async () => {
    auth.login.mockRejectedValue(apiError(428, { message: "Complete the puzzle", code: "captcha_required" }));

    await submit();

    await waitFor(() => expect(screen.getByText("solve-mosaic")).toBeTruthy());
    expect(screen.queryByText("login.invalidCredentials")).toBeNull();
  });
});
