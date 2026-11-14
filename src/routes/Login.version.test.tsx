// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * No app version on the sign-in screen (owner, 2026-11-14, second call): the
 * version lives ONLY in the side menu under the brand. The sign-in keeps the
 * order the owner set on 2026-11-13 — mark, wordmark, title, card — in the
 * desktop app as on the web, in every language.
 */

const PKG_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")) as { version: string }).version;

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ login: vi.fn() }) }));
const lang = vi.hoisted(() => ({ code: "en" as "en" | "ru" | "am" }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, lang.code), lang: lang.code, setLang: () => {} }) };
});
vi.mock("@/auth/recentEmails", () => ({
  recentEmails: { list: async () => [], forget: async () => {}, remember: async () => {} },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

import Login from "./Login";

/** The preload's bridge, as the Electron shell exposes it. */
const BRIDGE: NonNullable<Window["desktopAPI"]> = {
  get: async () => null,
  set: async () => {},
  remove: async () => {},
  wakeOnLan: async () => ({ ok: true, mac: "", sent: 0, errors: [], message: "" }),
};

afterEach(() => {
  cleanup();
  lang.code = "en";
  delete window.desktopAPI;
  vi.unstubAllGlobals();
});

const mount = () => render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
const stageOrder = (container: HTMLElement) =>
  [...(container.querySelector(".login-stage") as HTMLElement).children].map((el) => el.className.split(" ")[0]);
const versionPattern = new RegExp(`Version|Версия|Տարբերակ|${PKG_VERSION.replace(/\./g, "\\.")}`);

describe("the sign-in shows no version", () => {
  test.each(["en", "ru", "am"] as const)("in the desktop app, in %s: mark, wordmark, title, card", (code) => {
    vi.stubGlobal("__APP_VERSION__", PKG_VERSION);
    window.desktopAPI = BRIDGE;
    lang.code = code;
    const { container } = mount();
    expect(container.querySelector(".login-version")).toBeNull();
    expect(container.textContent).not.toMatch(versionPattern);
    expect(stageOrder(container)).toEqual(["login-logo", "login-brand", "login-title", "login-flip-wrap"]);
    expect(container.querySelector("h1.login-brand")?.textContent).toBe("Cyber Place");
  });

  test("on the web either", () => {
    vi.stubGlobal("__APP_VERSION__", "0.1.0");
    const { container } = mount();
    expect(container.querySelector(".login-version")).toBeNull();
    expect(container.textContent).not.toMatch(/Version|0\.1\.0/);
    expect(stageOrder(container)).toEqual(["login-logo", "login-brand", "login-title", "login-flip-wrap"]);
  });
});
