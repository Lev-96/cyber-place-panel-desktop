// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * A message on the sign-in card follows a language switch made while it is on
 * screen (2026-10-07). Before, the card stored the sentence of the moment it
 * failed, so switching the language left the error in the old one.
 */

const auth = vi.hoisted(() => ({ login: vi.fn(async (_email: string, _password: string) => {}) }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
const forgot = vi.hoisted(() => ({ fn: vi.fn(async (_email: string) => {}) }));
vi.mock("@/api/auth", () => ({ apiForgotPassword: forgot.fn }));
// A real language state, as small as the screen needs: the picker on the card
// switches it, and `t` answers in the language it holds.
vi.mock("@/i18n/LanguageContext", async () => {
  const React = await import("react");
  const { t } = await import("@/i18n/translations");
  type Lang = "en" | "ru" | "am";
  const Ctx = React.createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string } | null>(null);
  const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [lang, setLang] = React.useState<Lang>("en");
    return React.createElement(Ctx.Provider, { value: { lang, setLang, t: (k: string) => t(k, lang) } }, children);
  };
  return { LanguageProvider, useLang: () => React.useContext(Ctx)! };
});
vi.mock("@/auth/recentEmails", () => ({
  recentEmails: { list: async () => [], forget: async () => {}, remember: async () => {} },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

import { LanguageProvider } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import Login from "./Login";

const apiError = (status: number, body: unknown, message = `HTTP ${status}`) =>
  Object.assign(new Error(message), { status, body });

const renderAt = (path = "/login") =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Login />
      </MemoryRouter>
    </LanguageProvider>,
  );

const signIn = () => {
  const form = document.querySelector("form.login-card") as HTMLFormElement;
  fireEvent.submit(form);
};

const switchTo = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

afterEach(() => {
  cleanup();
  auth.login.mockReset();
  forgot.fn.mockReset();
});

describe("a sign-in message follows the language switch", () => {
  test("wrong credentials", async () => {
    auth.login.mockRejectedValueOnce(apiError(422, { errors: { password: ["x"] } }));
    renderAt();
    signIn();
    await screen.findByText(t("login.invalidCredentials", "en"));

    switchTo("Русский");
    expect(screen.getByRole("alert").textContent).toBe(t("login.invalidCredentials", "ru"));
    switchTo("Հայերեն");
    expect(screen.getByRole("alert").textContent).toBe(t("login.invalidCredentials", "am"));
  });

  test("a block, by its code", async () => {
    auth.login.mockRejectedValueOnce(apiError(403, { code: "company_blocked", scope: "company", message: "Company blocked" }));
    renderAt();
    signIn();
    await screen.findByText(t("blocking.reason.company_blocked", "en"));

    switchTo("Русский");
    expect(screen.getByRole("alert").textContent).toBe(t("blocking.reason.company_blocked", "ru"));
  });

  test("a sentence only the server has stays as the server said it", async () => {
    auth.login.mockRejectedValueOnce(apiError(503, { message: "Service unavailable" }, "Service unavailable"));
    renderAt();
    signIn();
    await screen.findByText("Service unavailable");

    switchTo("Русский");
    expect(screen.getByRole("alert").textContent).toBe("Service unavailable");
  });

  test("the reset link's notice on the back of the card", async () => {
    renderAt("/forgot-password");
    const back = document.querySelector(".login-flip-face-back form") as HTMLFormElement;
    fireEvent.change(back.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "op@club.am" } });
    fireEvent.submit(back);
    await screen.findByText(t("forgot.successPrefix", "en"));

    switchTo("Русский");
    expect(screen.getByText(t("forgot.successPrefix", "ru"))).toBeTruthy();
  });

  test("the reset throttle, by its code", async () => {
    forgot.fn.mockRejectedValueOnce(apiError(429, { code: "too_many_attempts", retry_after: 30, message: "Too many" }, "Too many"));
    renderAt("/forgot-password");
    const back = document.querySelector(".login-flip-face-back form") as HTMLFormElement;
    fireEvent.change(back.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "op@club.am" } });
    fireEvent.submit(back);
    await waitFor(() => expect(screen.getByText(t("login.hold.throttled", "en"))).toBeTruthy());

    switchTo("Русский");
    expect(screen.getByText(t("login.hold.throttled", "ru"))).toBeTruthy();
  });
});

/**
 * B8 (audit 2026-11-13, panel part): a network failure showed the browser's
 * own English «Failed to fetch» on the sign-in card and on the reset face. It
 * is said in our words now, stored as a key so a language switch re-says it.
 */
describe("no connection is said in our words", () => {
  const offline = () => new TypeError("Failed to fetch");

  test("sign-in", async () => {
    auth.login.mockRejectedValueOnce(offline());
    renderAt();
    signIn();
    await screen.findByText(t("auth.noConnection", "en"));
    expect(document.body.textContent).not.toContain("Failed to fetch");

    switchTo("Русский");
    expect(screen.getByRole("alert").textContent).toBe("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
    switchTo("Հայերեն");
    expect(screen.getByRole("alert").textContent).toBe("Սերվերի հետ կապ չկա։ Ստուգեք ինտերնետը և նորից փորձեք։");
  });

  test("the reset face", async () => {
    forgot.fn.mockRejectedValueOnce(offline());
    renderAt("/forgot-password");
    const back = document.querySelector(".login-flip-face-back form") as HTMLFormElement;
    fireEvent.change(back.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "op@club.am" } });
    fireEvent.submit(back);
    await screen.findByText(t("auth.noConnection", "en"));
    expect(document.body.textContent).not.toContain("Failed to fetch");

    switchTo("Русский");
    expect(screen.getByText("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.")).toBeTruthy();
  });

  test("a server sentence on the reset face is still the server's", async () => {
    forgot.fn.mockRejectedValueOnce(apiError(422, { message: "We can't find a user with that email address." }, "We can't find a user with that email address."));
    renderAt("/forgot-password");
    const back = document.querySelector(".login-flip-face-back form") as HTMLFormElement;
    fireEvent.change(back.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: "op@club.am" } });
    fireEvent.submit(back);
    await screen.findByText("We can't find a user with that email address.");
  });
});
