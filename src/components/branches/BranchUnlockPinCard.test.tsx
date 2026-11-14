// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * N1 (regression 2026-11-14): the emergency-PIN card said «PIN not set yet»
 * while a PIN was set, because `GET /branches/{id}` did not carry
 * `unlock_pin_updated_at`. The backend sends it now; the card also stops
 * contradicting itself when the date is missing but `/unlock-pin` returns a PIN.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("@/api/branches", () => ({
  apiGetBranchUnlockPin: (...a: unknown[]) => api.get(...a),
  apiSetBranchUnlockPin: (...a: unknown[]) => api.set(...a),
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import BranchUnlockPinCard from "./BranchUnlockPinCard";

const mount = async (updatedAt: string | null) => {
  await act(async () => {
    render(<BranchUnlockPinCard branchId={3} updatedAt={updatedAt} onSaved={() => {}} />);
  });
};

afterEach(() => { cleanup(); api.get.mockReset(); });

describe("BranchUnlockPinCard status line", () => {
  test("a PIN with no date: says it is set, never «not set»", async () => {
    api.get.mockResolvedValue({ data: { pin: "4821" } });
    await mount(null);
    expect(screen.queryByText("unlockPin.notSet")).toBeNull();
    expect(screen.getByText("unlockPin.isSet")).toBeTruthy();
  });

  test("a PIN with its date: «set · date»", async () => {
    api.get.mockResolvedValue({ data: { pin: "4821" } });
    await mount("2026-11-14T10:00:00Z");
    expect(screen.getByText(/unlockPin\.setAt|Set ·/)).toBeTruthy();
    expect(screen.queryByText("unlockPin.notSet")).toBeNull();
  });

  test("no PIN and no date: «not set»", async () => {
    api.get.mockResolvedValue({ data: { pin: null } });
    await mount(null);
    expect(screen.getAllByText("unlockPin.notSet").length).toBeGreaterThan(0);
  });
});
