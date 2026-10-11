// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * "Register computer" right after a PC place is created (2026-10-11). The
 * server provisions the place's device with the place, so this is the
 * existing PcForm on THAT device: save updates it (never a second device),
 * then the pairing token; "Not now" closes and the place stays.
 */

const pcs = vi.hoisted(() => ({ listByBranch: vi.fn(), update: vi.fn(), create: vi.fn(), rotateToken: vi.fn() }));
const places = vi.hoisted(() => ({ listRawByBranch: vi.fn(), remove: vi.fn() }));
vi.mock("@/repositories/PcRepository", () => ({ pcRepository: pcs }));
vi.mock("@/repositories/PlaceRepository", () => ({ placeRepository: places }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => ({ id: 7, price_for_branch: { "pc-standard": 800 } }) },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import RegisterPlaceComputer from "./RegisterPlaceComputer";

const PLACE = { id: 41, branch_id: 7, number: 5, name: null, type: "standard", status: "active", platform: "pc", games: [] };
const OTHER = { id: 40, branch_id: 7, number: 4, name: null, type: "standard", status: "active", platform: "pc", games: [] };
const device = (over: Record<string, unknown> = {}) => ({
  id: 90, branch_id: 7, place_id: 41, label: "№5", kind: "pc", status: "offline", last_seen_at: null, ...over,
});

const onClose = vi.fn();
const mount = async () => {
  await act(async () => { render(<RegisterPlaceComputer branchId={7} placeId={41} onClose={onClose} />); });
};
const save = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); }); };

beforeEach(() => {
  for (const f of [...Object.values(pcs), ...Object.values(places), onClose]) f.mockReset();
  places.listRawByBranch.mockResolvedValue([OTHER, PLACE]);
  pcs.listByBranch.mockResolvedValue([device({ id: 89, place_id: 40, label: "№4" }), device()]);
  pcs.update.mockImplementation(async (id: number, b: object) => ({ ...device(), ...b, id }));
  pcs.rotateToken.mockResolvedValue({ ...device(), pairing_token: "tok-123" });
});
afterEach(cleanup);

describe("registering the computer of a new PC place", () => {
  test("opens the Register computer form on the place's own device", async () => {
    await mount();
    expect(screen.getByText("pcs.newDevice")).toBeTruthy();
    expect(screen.getByRole("button", { name: "pcs.notNow" })).toBeTruthy();
    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("41");
    // Another place's device keeps its place off the list.
    expect([...select.options].map((o) => o.value)).not.toContain("40");
  });

  test("save updates that device — never a second one — then shows its pairing token", async () => {
    await mount();
    fireEvent.change(screen.getByPlaceholderText("AA:BB:CC:DD:EE:FF"), { target: { value: "AA:BB:CC:DD:EE:01" } });
    await save();

    expect(pcs.create).not.toHaveBeenCalled();
    expect(pcs.update).toHaveBeenCalledWith(90, expect.objectContaining({ place_id: 41, mac_address: "AA:BB:CC:DD:EE:01" }));
    expect(pcs.rotateToken).toHaveBeenCalledWith(90);
    await waitFor(() => expect(screen.getByText("tok-123")).toBeTruthy());
  });

  test("Not now closes it; nothing is written and the place is not touched", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "pcs.notNow" })); });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pcs.update).not.toHaveBeenCalled();
    expect(places.remove).not.toHaveBeenCalled();
  });

  test("a failed registration stays open with its error, to retry or close; the place stays", async () => {
    pcs.update.mockRejectedValueOnce(new Error("MAC already in use"));
    await mount();
    await save();

    expect(screen.getByText("MAC already in use")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(places.remove).not.toHaveBeenCalled();
    await save();
    expect(pcs.update).toHaveBeenCalledTimes(2);
  });

  test("an agent already paired keeps its token: saved and closed, no rotation", async () => {
    pcs.listByBranch.mockResolvedValue([device({ last_seen_at: "2026-10-11 10:00:00" })]);
    pcs.update.mockImplementation(async (id: number, b: object) => ({ ...device({ last_seen_at: "2026-10-11 10:00:00" }), ...b, id }));
    await mount();
    await save();

    expect(pcs.rotateToken).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test("no device for the place yet: said plainly, retry or Not now — never a create", async () => {
    pcs.listByBranch.mockResolvedValueOnce([]);
    await mount();
    expect(screen.getByText("pcs.registerPlace.missing")).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.retry" })); });
    expect(await screen.findByText("pcs.newDevice")).toBeTruthy();
    expect(document.querySelector("select")).toBeTruthy();
    expect(pcs.create).not.toHaveBeenCalled();
  });
});
