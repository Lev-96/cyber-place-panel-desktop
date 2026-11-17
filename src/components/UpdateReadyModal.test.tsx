// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DesktopUpdateState } from "@/types/desktopUpdates";

/** «Новая версия готова» may be put off (2026-11-17): «Позже» hides it for this version. */
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import UpdateReadyModal from "./UpdateReadyModal";

const ready: DesktopUpdateState = { status: "downloaded", currentVersion: "1.0.64", availableVersion: "1.0.65", progressPercent: 100, notes: null, error: null };
const bridge = { getState: vi.fn(async () => ready), onState: vi.fn(() => () => {}), install: vi.fn(async () => {}), check: vi.fn(), checkGated: vi.fn() };

beforeEach(() => {
  bridge.install.mockClear();
  (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates = bridge;
});
afterEach(() => { cleanup(); delete (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates; });

describe("UpdateReadyModal", () => {
  test("«Позже» closes it without installing", async () => {
    await act(async () => { render(<UpdateReadyModal />); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("updates.readyModalRestart")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("update-ready-later")); });
    expect(screen.queryByText("updates.readyModalRestart")).toBeNull();
    expect(bridge.install).not.toHaveBeenCalled();
  });

  test("restart installs", async () => {
    await act(async () => { render(<UpdateReadyModal />); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByText("updates.readyModalRestart")); });
    expect(bridge.install).toHaveBeenCalledTimes(1);
  });
});
