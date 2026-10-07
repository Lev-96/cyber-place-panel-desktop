// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import SettingsSection from "./SettingsSection";

afterEach(cleanup);

describe("SettingsSection", () => {
  test("ready: title, description, actions and the body", () => {
    render(<SettingsSection title="Rounding" description="How totals round" actions={<button>new</button>}><form>body</form></SettingsSection>);
    expect(screen.getByRole("heading", { name: "Rounding" })).toBeTruthy();
    expect(screen.getByText("How totals round")).toBeTruthy();
    expect(screen.getByText("new")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });

  test("loading: no body", () => {
    render(<SettingsSection title="T" loading><form>body</form></SettingsSection>);
    expect(screen.queryByText("body")).toBeNull();
  });

  test("failed: the error state (server sentence as its detail) and a retry, and NEVER the body", () => {
    const onRetry = vi.fn();
    const failure = Object.assign(new Error("Server down"), { status: 500, body: { message: "Server down" } });
    render(<SettingsSection title="T" error={failure} onRetry={onRetry} loading><form>body</form></SettingsSection>);
    expect(screen.getByRole("alert").textContent).toContain("state.error.title");
    expect(screen.getByRole("alert").textContent).toContain("Server down");
    expect(screen.queryByText("body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "action.retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("offline: said as offline, with a retry", () => {
    const onRetry = vi.fn();
    render(<SettingsSection title="T" error={new TypeError("Failed to fetch")} onRetry={onRetry}><form>body</form></SettingsSection>);
    expect(screen.getByRole("alert").textContent).toContain("state.offline.title");
    expect(screen.queryByText("Failed to fetch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "action.retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
