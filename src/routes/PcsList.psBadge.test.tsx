// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import type { IPcApi } from "@/types/sessions";

/**
 * The "PS" badge on the devices list is the PLACE's platform.
 *
 * A billiards table registered as a billing-only device has `kind: "ps"`
 * (no kiosk agent) and is no console. The kind still decides the agent
 * controls (no MAC, no Wake, no token) — that question it answers correctly.
 */

const devices = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock("@/repositories/PcRepository", () => ({
  pcRepository: { listByBranch: () => Promise.resolve(devices.list) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en" }),
}));

import PcsList from "./PcsList";

const device = (over: Partial<IPcApi>): IPcApi => ({
  id: 1, branch_id: 7, label: "Seat", kind: PC_KIND.Ps, status: PC_STATUS.Online, ...over,
});

const mount = async (list: IPcApi[]) => {
  devices.list = list;
  await act(async () => {
    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={["/branches/7/pcs"]}>
          <Routes><Route path="/branches/:branchId/pcs" element={<PcsList />} /></Routes>
        </MemoryRouter>
      </ConfirmProvider>,
    );
  });
};
const rowOf = (label: string) => screen.getByText(label).closest(".list-item")!;
const hasBadge = (label: string) => [...rowOf(label).querySelectorAll("span")].some((s) => s.textContent === "PS");

afterEach(cleanup);

describe("the PS badge", () => {
  test("is drawn on a PS5 seat and not on a billiards seat on the same kind of device", async () => {
    await mount([
      device({ id: 1, label: "Console A", place_id: 10, place: { id: 10, number: 1, type: "standard", platform: "ps5" } }),
      device({ id: 2, label: "Table B", place_id: 11, place: { id: 11, number: 2, type: "standard", platform: "billiards" } }),
    ]);

    expect(hasBadge("Console A")).toBe(true);
    expect(hasBadge("Table B")).toBe(false);
    // Still agentless: no pairing-token button on either.
    expect(rowOf("Table B").textContent).not.toContain("pcs.getToken");
  });

  test("falls back to the kind for a device with no place", async () => {
    await mount([device({ id: 3, label: "Loose console", place_id: null, place: null })]);

    expect(hasBadge("Loose console")).toBe(true);
  });
});
