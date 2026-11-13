// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * «Свои продукты» on the card (2026-11-13, owner: "after Start that price is
 * added to the card"). The fee is a bill line the server wrote at Start; the
 * card names it apart from the products and never counts it as one of them.
 * Its figure is the line's own; the card's total already includes it (the
 * board sums every non-hourly line), so nothing is added here.
 */
const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/repositories/JoystickPriceRepository", () => ({ joystickPriceRepository: { listByBranch: () => Promise.resolve([]) } }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { get: () => Promise.resolve({ branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 0, joystick_included: 2, joystick_charged_slots: null, joystick_pricing_mode: "fixed" }) },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n} AMD`, lang: "am" }) }));

import SessionsBoard from "./SessionsBoard";

const device: IPcApi = {
  id: 1, branch_id: 7, place_id: 10, label: "PC-1", kind: PC_KIND.Pc, status: PC_STATUS.InSession, is_startable: true,
  place: { id: 10, number: 1, name: "", type: "standard", platform: "pc" },
} as IPcApi;
const session = (items: NonNullable<ISessionApi["items"]>): ISessionApi => ({
  id: 42, branch_id: 7, pc_id: 1, pc_label: "PC-1", mode: "open", status: "active",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(), ends_at: null,
  hourly_rate: 1000, total_paid: 0, is_free: false, paused_at: null, items,
} as ISessionApi);
// The line as a Russian-speaking cashier's start wrote it.
const fee = { id: 7, name: "Свои продукты", price: "1500.00", qty: 1, product_id: null, kind: "outside_food" as const };
const cola = { id: 8, name: "Cola", price: "500.00", qty: 2, product_id: 3, kind: null };

const mount = async (s: ISessionApi) => {
  repo.listActive.mockResolvedValue([s]);
  await act(async () => {
    render(<ConfirmProvider><MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter></ConfirmProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const secondary = () => document.querySelector(".session-card .session-card__secondary")?.textContent ?? "";

beforeEach(() => { repo.listPcs.mockResolvedValue([device]); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("«Свои продукты» on the card", () => {
  test("the note says the fee by its kind, in the panel's language, with the line's figure", async () => {
    await mount(session([fee]));
    const note = screen.getByTestId("outside-food-note-1");
    expect(note.textContent).toContain("session.outsideFood.cardNote");
    expect(note.textContent).not.toContain("Свои продукты");
    expect(note.querySelector("strong")?.textContent).toBe("+1500 AMD");
  });

  test("the fee alone is not «1 товар»", async () => {
    await mount(session([fee]));
    expect(secondary()).not.toContain("session.posNote");
  });

  test("with products, only the products are counted", async () => {
    await mount(session([fee, cola]));
    expect(secondary()).toContain("· 1 session.posNote");
  });

  test("no fee line (never on, or removed): no note", async () => {
    await mount(session([cola]));
    expect(screen.queryByTestId("outside-food-note-1")).toBeNull();
    expect(secondary()).toContain("· 1 session.posNote");
  });
});
