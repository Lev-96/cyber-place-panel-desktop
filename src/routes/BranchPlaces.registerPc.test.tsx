// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Creating a PC place opens "Register computer" for it (2026-10-11) — only
 * after a successful create that returned the place, only for PC, and only
 * once: a reload of the list (a realtime refetch) never reopens it.
 */

const list = vi.hoisted(() => ({ listRawByBranch: vi.fn() }));
vi.mock("@/repositories/PlaceRepository", () => ({ placeRepository: list }));
vi.mock("@/repositories/PlatformPriceRepository", () => ({ platformPriceRepository: { listByBranch: async () => [] } }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => false }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));
vi.mock("@/components/ps5/ConsolePicker", () => ({ default: () => null }));
// The form itself is covered elsewhere; here it only reports how the save went.
vi.mock("@/components/places/PlaceForm", () => ({
  default: ({ onSaved, onClose }: { onSaved: (p?: unknown) => void; onClose: () => void }) => (
    <div>
      <button type="button" onClick={() => onSaved({ id: 41, platform: "pc" })}>saved pc</button>
      <button type="button" onClick={() => onSaved({ id: 42, platform: "ps5" })}>saved ps5</button>
      <button type="button" onClick={() => onSaved({ id: 43, platform: "billiards" })}>saved custom</button>
      <button type="button" onClick={() => onSaved(null)}>saved without a place</button>
      <button type="button" onClick={onClose}>failed and closed</button>
    </div>
  ),
}));
vi.mock("@/components/pcs/RegisterPlaceComputer", () => ({
  default: ({ placeId, onClose }: { placeId: number; onClose: () => void }) => (
    <div>
      <span>register computer for {placeId}</span>
      <button type="button" onClick={onClose}>not now</button>
    </div>
  ),
}));

import BranchPlaces from "./BranchPlaces";

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/7/places"]}>
        <Routes><Route path="/branches/:branchId/places" element={<BranchPlaces />} /></Routes>
      </MemoryRouter>,
    );
  });
};
const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
const registering = () => screen.queryByText(/register computer for/);

beforeEach(() => { list.listRawByBranch.mockReset(); list.listRawByBranch.mockResolvedValue([]); });
afterEach(cleanup);

describe("creating a place", () => {
  test("a PC place opens Register computer for that place", async () => {
    await mount();
    await click("branchPlaces.new");
    await click("saved pc");

    expect(registering()?.textContent).toBe("register computer for 41");
  });

  test("another platform does not", async () => {
    for (const saved of ["saved ps5", "saved custom", "saved without a place"]) {
      await mount();
      await click("branchPlaces.new");
      await click(saved);
      expect(registering(), saved).toBeNull();
      cleanup();
    }
  });

  test("a failed create (form closed, nothing saved) does not", async () => {
    await mount();
    await click("branchPlaces.new");
    await click("failed and closed");

    expect(registering()).toBeNull();
  });

  test("Not now closes it, and the list reloading never reopens it", async () => {
    await mount();
    await click("branchPlaces.new");
    await click("saved pc");
    const reads = list.listRawByBranch.mock.calls.length;
    await click("not now");

    expect(registering()).toBeNull();
    expect(reads).toBeGreaterThan(1); // the list was reloaded after the save
    expect(registering()).toBeNull();
  });
});
