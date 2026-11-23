// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";

/**
 * «PlayStation без Android-телевизора» (2026-11-23): shown only while the
 * backend sends PSN place messages; one console account per PlayStation place.
 */
const api = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn() }));
vi.mock("@/api/psnPlaces", async () => {
  const real = await vi.importActual<typeof import("@/api/psnPlaces")>("@/api/psnPlaces");
  return { ...real, apiListPsnPlaces: (...a: unknown[]) => api.list(...a), apiSetPlacePsnAccounts: (...a: unknown[]) => api.set(...a) };
});
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), lang: "ru" }) };
});
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "company_owner", dashboard: { company_id: 4 } } }) }));
vi.mock("@/components/ps5/PsnSenderCard", () => ({ default: ({ companyId, descriptionKey }: { companyId: number; descriptionKey?: string }) => <div data-testid="sender" data-desc={descriptionKey}>{companyId}</div> }));

import TvPsnPlaces from "./TvPsnPlaces";

const places = [
  { id: 7, branch_id: 1, number: 7, name: null, platform: "ps5", type: "standard", status: "active" },
  { id: 8, branch_id: 1, number: 8, name: null, platform: "ps4", type: "standard", status: "active" },
  { id: 9, branch_id: 1, number: 9, name: "Pool", platform: "billiards", type: "standard", status: "active" },
] as unknown as IBranchPlace[];

const mount = async () => {
  await act(async () => { render(<TvPsnPlaces branchId={1} places={places} placeLabel={(p) => `№${p.number}`} />); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); });
afterEach(cleanup);

describe("TvPsnPlaces", () => {
  test("nothing while the backend does not send PSN place messages", async () => {
    api.list.mockResolvedValue({ enabled: false, data: [] });
    await mount();
    expect(screen.queryByTestId("tv-psn")).toBeNull();
  });

  test("the company's sender and one field per PlayStation place only", async () => {
    api.list.mockResolvedValue({ enabled: true, data: [{ place_id: 7, online_ids: ["ClubPS7", "Guest_Ani"] }] });
    await mount();
    expect(screen.getByTestId("sender").textContent).toBe("4");
    expect(screen.getByTestId("sender").getAttribute("data-desc")).toBe("psn.description.places");
    const rows = screen.getAllByTestId("tv-psn-row");
    expect(rows.map((r) => r.textContent?.slice(0, 2))).toEqual(["№7", "№8"]);
    expect((rows[0].querySelector("input") as HTMLInputElement).value).toBe("ClubPS7, Guest_Ani");
  });

  test("saves several names, refuses an invalid one or more than eight, clears to remove", async () => {
    api.list.mockResolvedValue({ enabled: true, data: [{ place_id: 7, online_ids: ["ClubPS7", "Guest_Ani"] }] });
    api.set.mockResolvedValue({ data: { place_id: 8, online_ids: [], checked: true } });
    await mount();
    const row8 = screen.getAllByTestId("tv-psn-row")[1];
    const input8 = row8.querySelector("input") as HTMLInputElement;
    const save8 = row8.querySelector("button") as HTMLButtonElement;

    fireEvent.change(input8, { target: { value: "ClubPS8, 1 bad" } });
    expect(save8.disabled).toBe(true);
    fireEvent.change(input8, { target: { value: Array.from({ length: 9 }, (_, i) => `Player_${i}`).join(",") } });
    expect(save8.disabled).toBe(true);
    fireEvent.change(input8, { target: { value: "ClubPS8,  Guest_Bob ;Guest_Cat" } });
    expect(save8.disabled).toBe(false);
    await act(async () => { fireEvent.click(save8); });
    await flush();
    expect(api.set).toHaveBeenCalledWith(8, ["ClubPS8", "Guest_Bob", "Guest_Cat"]);

    const row7 = screen.getAllByTestId("tv-psn-row")[0];
    fireEvent.change(row7.querySelector("input") as HTMLInputElement, { target: { value: "" } });
    await act(async () => { fireEvent.click(row7.querySelector("button") as HTMLButtonElement); });
    await flush();
    expect(api.set).toHaveBeenLastCalledWith(7, []);
  });

  test("Sony's answers are said in words: unknown names, the sender listed, not checked", async () => {
    api.list.mockResolvedValue({ enabled: true, data: [] });
    await mount();
    const row = screen.getAllByTestId("tv-psn-row")[0];
    const input = row.querySelector("input") as HTMLInputElement;
    const save = row.querySelector("button") as HTMLButtonElement;

    api.set.mockRejectedValueOnce(Object.assign(new Error("x"), { body: { code: "psn_unknown_online_ids", unknown: ["CyberPlace-pro_1"] } }));
    fireEvent.change(input, { target: { value: "CyberPlace-pro_1" } });
    await act(async () => { fireEvent.click(save); });
    await flush();
    expect(screen.getByRole("alert").textContent).toContain("нет такого аккаунта: CyberPlace-pro_1");

    api.set.mockRejectedValueOnce(Object.assign(new Error("x"), { body: { code: "psn_sender_is_console", online_id: "CyberPlace-pro" } }));
    fireEvent.change(input, { target: { value: "CyberPlace-pro" } });
    await act(async () => { fireEvent.click(save); });
    await flush();
    expect(screen.getByRole("alert").textContent).toContain("CyberPlace-pro отправляет сообщения");

    api.set.mockResolvedValueOnce({ data: { place_id: 7, online_ids: ["Someone_1"], checked: false } });
    fireEvent.change(input, { target: { value: "Someone_1" } });
    await act(async () => { fireEvent.click(save); });
    await flush();
    expect(screen.getByTestId("tv-psn-notice").textContent).toContain("проверятся при первом сообщении");
  });

  test("as the dialog's only content it says when the server does not send, and drops its own title", async () => {
    api.list.mockResolvedValue({ enabled: false, data: [] });
    await act(async () => { render(<TvPsnPlaces branchId={1} places={places} placeLabel={(p) => `№${p.number}`} standalone />); });
    await flush();
    expect(screen.getByTestId("tv-psn-off").textContent).toContain("выключены");
    cleanup();

    api.list.mockResolvedValue({ enabled: true, data: [] });
    await act(async () => { render(<TvPsnPlaces branchId={1} places={places} placeLabel={(p) => `№${p.number}`} standalone />); });
    await flush();
    expect(screen.getByTestId("tv-psn").textContent).not.toContain("PlayStation без Android-телевизора");
  });
});
