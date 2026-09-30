// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const spies = vi.hoisted(() => ({ clear: vi.fn(), disconnect: vi.fn() }));
vi.mock("@/api/client", () => ({ apiCache: { clear: spies.clear } }));
vi.mock("@/realtime/echo", () => ({ disconnectEchoForSignOut: spies.disconnect }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", t: (k: string) => t(k, "ru") }) };
});

import { networkBlock } from "@/auth/networkBlock";
import NetworkBlockedScreen, { useNetworkBlock } from "./NetworkBlockedScreen";

/** What the app shows once the address is blocked (2026-10-01). */

const Probe = () => {
  const blocked = useNetworkBlock();
  return blocked ? <NetworkBlockedScreen code={blocked} /> : <div>the app</div>;
};

beforeEach(() => { networkBlock.resetForTests(); spies.clear.mockReset(); spies.disconnect.mockReset(); });
afterEach(() => { cleanup(); networkBlock.resetForTests(); });

describe("the blocked screen", () => {
  test("replaces the whole app the moment a block is reported, and drops cache and socket", () => {
    render(<Probe />);
    expect(screen.getByText("the app")).toBeTruthy();

    act(() => networkBlock.raise("ip_blocked"));

    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Доступ к Cyber Place с вашего IP-адреса закрыт администратором.");
    expect(spies.clear).toHaveBeenCalledTimes(1);
    expect(spies.disconnect).toHaveBeenCalledTimes(1);
  });

  test("a block noticed before the screen mounted is still shown", () => {
    networkBlock.raise("country_blocked");
    render(<Probe />);
    expect(screen.getByText("Доступ к Cyber Place из вашей страны закрыт администратором.")).toBeTruthy();
  });

  test("check again reloads the app", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    networkBlock.raise("ip_blocked");
    render(<Probe />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить снова" }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  test("App.tsx shows it instead of everything, before anything else renders", () => {
    const app = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    const block = app.indexOf("if (blocked) return <NetworkBlockedScreen code={blocked} />;");
    expect(block).toBeGreaterThan(-1);
    expect(block).toBeLessThan(app.indexOf("if (loading) return <Spinner />;"));
  });
});
