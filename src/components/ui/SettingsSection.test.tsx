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

  test("failed: the message and a retry, and NEVER the body", () => {
    const onRetry = vi.fn();
    render(<SettingsSection title="T" error={new Error("Network down")} onRetry={onRetry} loading><form>body</form></SettingsSection>);
    expect(screen.getByRole("alert").textContent).toContain("Network down");
    expect(screen.queryByText("body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "action.retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
