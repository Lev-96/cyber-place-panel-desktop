// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DesktopUpdateState } from "@/types/desktopUpdates";

/**
 * «Обновление приложения» (2026-11-17, owner): the version, «Проверить
 * обновления» answered in a popup, «Установить и перезапустить» once ready.
 * The approved version is the server's (manifest); the updater fetches it.
 */
const api = vi.hoisted(() => ({ manifest: vi.fn() }));
vi.mock("@/api/updates", () => ({ apiGetManifest: () => api.manifest() }));
const toast = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toast.message(...a) } }));
const confirm = vi.hoisted(() => ({ fn: vi.fn(async () => true) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => confirm.fn }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => `${k}:{0}:{1}`, lang: "en" }) }));

import DesktopUpdateCard from "./DesktopUpdateCard";

const state = (over: Partial<DesktopUpdateState> = {}): DesktopUpdateState => ({
  status: "idle", currentVersion: "1.0.64", availableVersion: null, progressPercent: null, notes: null, error: null, ...over,
});
let listener: ((s: DesktopUpdateState) => void) | null = null;
const bridge = {
  check: vi.fn(),
  checkGated: vi.fn(),
  install: vi.fn(async () => {}),
  getState: vi.fn(),
  onState: vi.fn((cb: (s: DesktopUpdateState) => void) => { listener = cb; return () => { listener = null; }; }),
};
const toasts = () => toast.message.mock.calls.map((c) => `${c[0]}|${c[1]}`);

const mount = async () => {
  await act(async () => { render(<DesktopUpdateCard />); });
  await act(async () => { await Promise.resolve(); });
};
const press = async (id: string) => { await act(async () => { fireEvent.click(screen.getByTestId(id)); }); };

beforeEach(() => {
  Object.values(bridge).forEach((f) => (f as ReturnType<typeof vi.fn>).mockClear?.());
  bridge.getState.mockResolvedValue(state());
  api.manifest.mockReset();
  toast.message.mockReset();
  confirm.fn.mockClear();
  (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates = bridge;
});
afterEach(() => { cleanup(); delete (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates; });

describe("DesktopUpdateCard", () => {
  test("shows the installed version", async () => {
    await mount();
    expect(screen.getByTestId("desktop-update-version").textContent).toContain("1.0.64");
  });

  test("«Проверить»: the server's version is the one installed → «you have the latest», the updater is not asked", async () => {
    api.manifest.mockResolvedValue({ version: "1.0.64" });
    await mount();
    await press("desktop-update-check");
    expect(toasts()).toEqual(["success|ownUpdates.upToDate:1.0.64:{1}"]);
    expect(bridge.checkGated).not.toHaveBeenCalled();
  });

  test("«Проверить»: a newer approved version → fetched, and the popup says it was found", async () => {
    api.manifest.mockResolvedValue({ version: "1.0.65" });
    bridge.checkGated.mockResolvedValue(state({ status: "downloading", availableVersion: "1.0.65", progressPercent: 10 }));
    await mount();
    await press("desktop-update-check");
    expect(bridge.checkGated).toHaveBeenCalledWith("1.0.65");
    expect(toasts()).toEqual(["success|ownUpdates.foundToast:1.0.65:{1}"]);
  });

  test("«Проверить»: already downloaded → the popup says it is ready", async () => {
    api.manifest.mockResolvedValue({ version: "1.0.65" });
    bridge.checkGated.mockResolvedValue(state({ status: "downloaded", availableVersion: "1.0.65" }));
    await mount();
    await press("desktop-update-check");
    expect(toasts()).toEqual(["success|ownUpdates.readyToast:1.0.65:{1}"]);
  });

  test("«Проверить» offline: an error popup, nothing claimed", async () => {
    api.manifest.mockRejectedValue(new Error("offline"));
    await mount();
    await press("desktop-update-check");
    expect(toasts()).toEqual(["error|ownUpdates.checkFailed:{0}:{1}"]);
  });

  test("ready: the big «Install and restart» asks first, then installs", async () => {
    await mount();
    expect(screen.queryByTestId("desktop-update-install")).toBeNull();
    await act(async () => { listener?.(state({ status: "downloaded", availableVersion: "1.0.65" })); });
    expect(screen.getByTestId("desktop-update-ready").textContent).toContain("1.0.65");
    await press("desktop-update-install");
    expect(confirm.fn).toHaveBeenCalledTimes(1);
    expect(bridge.install).toHaveBeenCalledTimes(1);
  });

  test("answered «no» at the confirm: nothing installed", async () => {
    confirm.fn.mockResolvedValueOnce(false);
    bridge.getState.mockResolvedValue(state({ status: "downloaded", availableVersion: "1.0.65" }));
    await mount();
    await press("desktop-update-install");
    expect(bridge.install).not.toHaveBeenCalled();
  });

  test("in a browser (owner web): no buttons, the page says it is always the newest", async () => {
    delete (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates;
    await mount();
    expect(screen.queryByTestId("desktop-update-check")).toBeNull();
    expect(screen.getByTestId("desktop-update-card").textContent).toContain("ownUpdates.webAlwaysLatest");
  });
});
