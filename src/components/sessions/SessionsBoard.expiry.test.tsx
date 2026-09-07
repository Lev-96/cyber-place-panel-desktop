// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import { SessionChangedEvent } from "@/realtime/useSessionChanged";
import SessionsBoard from "./SessionsBoard";

/**
 * A seat whose paid period runs out ends on the server, and the cashier has to
 * be told — that is money somebody now has to go and collect.
 *
 * The trigger is the event the board is ALREADY subscribed to. `kind` is
 * `stopped` for an auto-ending as much as for a manual one; what separates them
 * is `status`, which is `expired` when the clock ended it and `stopped` when a
 * person did. Only the first opens a receipt: a modal appearing on every desk
 * each time a colleague presses Stop would be noise.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn(), preview: vi.fn() }));
// The board's `useSessionChanged` handler, captured so a test can fire an event
// at it the way Reverb would.
const realtime = vi.hoisted(() => ({ handler: null as null | ((e: SessionChangedEvent) => void) }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    preview: (...a: unknown[]) => repo.preview(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({
  useSessionChanged: (_branchId: unknown, onChange: (e: SessionChangedEvent) => void) => {
    realtime.handler = onChange;
  },
}));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const device: IPcApi = {
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "PS4-08",
  kind: PC_KIND.Ps,
  status: PC_STATUS.InSession,
  place: { id: 10, number: 8, name: "PS4-08", type: "standard", platform: "ps5" },
};

/** A ten-minute tariff, still on the board when the event lands. */
const running = {
  id: 42,
  branch_id: 7,
  pc_id: 1,
  pc_label: "PS4-08",
  mode: "fixed",
  status: "active",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ends_at: new Date().toISOString(),
  hourly_rate: null,
  committed_amount: 250,
  total_paid: 250,
  is_free: false,
} as ISessionApi;

const event = (over: Partial<SessionChangedEvent> = {}): SessionChangedEvent => ({
  kind: "stopped",
  session_id: 42,
  branch_id: 7,
  pc_id: 1,
  place_id: 10,
  status: "expired",
  mode: "fixed",
  is_free: false,
  is_unlimited: false,
  joystick_count: 1,
  ends_at: null,
  at: new Date().toISOString(),
  ...over,
});

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <SessionsBoard branchId={7} />
      </MemoryRouter>,
    );
  });
};

const fire = async (e: SessionChangedEvent) => {
  await act(async () => {
    realtime.handler?.(e);
  });
};

describe("a seat that ends on its own clock", () => {
  beforeEach(() => {
    realtime.handler = null;
    repo.listPcs.mockResolvedValue([device]);
    repo.listActive.mockResolvedValue([running]);
    repo.preview.mockResolvedValue({
      mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 10,
      time_cost: 250, hourly_rate: 1500, package_name: "10m", items: [], items_total: 0,
      joysticks: [], joysticks_total: 0, subtotal: 250, gross_total: 250, total: 250,
    });
  });
  afterEach(cleanup);

  test("opens the receipt with what is owed", async () => {
    await mount();
    // Nothing on screen yet — the seat is still running.
    expect(screen.queryByText("session.checkoutDone")).toBeNull();

    await fire(event());

    // The bill the player now has to settle, and no offer to stop a seat that
    // has already stopped.
    expect(screen.getByText("session.checkoutDone")).toBeTruthy();
    expect(screen.getByText("session.totalDue")).toBeTruthy();
    expect(screen.queryByText("session.confirmStop")).toBeNull();
  });

  test("a colleague pressing Stop opens nothing", async () => {
    await mount();

    // Same event kind, and the status is what tells them apart.
    await fire(event({ status: "stopped" }));

    expect(screen.queryByText("session.checkoutDone")).toBeNull();
  });

  test("the other terms changing opens nothing", async () => {
    await mount();

    await fire(event({ kind: "time.added", status: "active" }));
    await fire(event({ kind: "free.changed", status: "active" }));

    expect(screen.queryByText("session.checkoutDone")).toBeNull();
  });

  test("an unknown seat is not invented a receipt for", async () => {
    await mount();

    // A branch this desk is not showing — nothing to price, so nothing opens.
    await fire(event({ session_id: 999 }));

    expect(screen.queryByText("session.checkoutDone")).toBeNull();
  });
});
