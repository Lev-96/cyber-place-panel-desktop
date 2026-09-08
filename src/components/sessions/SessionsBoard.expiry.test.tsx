// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
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

const repo = vi.hoisted(() => ({
  listPcs: vi.fn(), listActive: vi.fn(), preview: vi.fn(),
  addJoystick: vi.fn(), removeJoystick: vi.fn(),
}));
// The board's `useSessionChanged` handler, captured so a test can fire an event
// at it the way Reverb would.
const realtime = vi.hoisted(() => ({ handler: null as null | ((e: SessionChangedEvent) => void) }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    preview: (...a: unknown[]) => repo.preview(...a),
    addJoystick: (...a: unknown[]) => repo.addJoystick(...a),
    removeJoystick: (...a: unknown[]) => repo.removeJoystick(...a),
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
vi.mock("@/repositories/JoystickPriceRepository", () => ({
  joystickPriceRepository: { listByBranch: () => Promise.resolve([]) },
}));
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
      // The management dialog a tile opens asks before lifting a ceiling, and
      // in the app that provider comes from App.tsx above the whole shell.
      <ConfirmProvider>
        <MemoryRouter>
          <SessionsBoard branchId={7} />
        </MemoryRouter>
      </ConfirmProvider>,
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

/**
 * The same management dialog, reached from the card.
 *
 * "Options" already opened it, and that is not what somebody with eight
 * minutes left is scanning a tile for. The named button is a second way in to
 * ONE surface — not a second implementation of it.
 */
describe("adding time from the card", () => {
  beforeEach(() => {
    repo.listPcs.mockResolvedValue([device]);
    repo.listActive.mockResolvedValue([running]);
  });
  afterEach(cleanup);

  test("is offered on a seat that has an end", async () => {
    await mount();

    expect(screen.getByRole("button", { name: "session.addTime" })).toBeTruthy();
  });

  test("opens the management dialog", async () => {
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.addTime" }));
    });

    // The same dialog "Options" opens — asserted by its own heading, so a
    // second modal built for the card would fail this.
    expect(screen.getByText("session.options")).toBeTruthy();
  });

  test("is not offered on a seat with no end to extend", async () => {
    repo.listActive.mockResolvedValue([{ ...running, ends_at: null, is_unlimited: true }]);
    await mount();

    expect(screen.queryByRole("button", { name: "session.addTime" })).toBeNull();
    // Options is still there: a count-up session has pads and a bill to waive.
    expect(screen.getByRole("button", { name: "session.optionsShort" })).toBeTruthy();
  });
});

/**
 * Pads, managed from the tile.
 *
 * They were reachable only through the options dialog, which is two clicks and
 * a modal for the thing a cashier does most on a console: hand somebody a
 * second controller. The dialog is still there — this is a second door to the
 * same endpoints, not a second implementation.
 *
 * Whether a seat HAS pads is the backend's answer (`supports_joysticks`,
 * resolved from the place's platform) and never the label: "PS4-08" is a name
 * somebody typed, and a venue that renames a seat would lose its controls.
 */
describe("joysticks on the tile", () => {
  const ps = { ...running, supports_joysticks: true, joystick_count: 2,
    joysticks: [{ id: 5, slot: 2, hourly_rate: 500, started_at: new Date().toISOString(), stopped_at: null }] } as ISessionApi;

  beforeEach(() => {
    repo.listPcs.mockResolvedValue([device]);
    repo.addJoystick.mockResolvedValue(ps);
    repo.removeJoystick.mockResolvedValue(ps);
  });
  afterEach(cleanup);

  const add = () => screen.getByRole("button", { name: "session.joystickAddHere" }) as HTMLButtonElement;
  const drop = () => screen.getByRole("button", { name: "session.joystickRemoveHere" }) as HTMLButtonElement;

  test("are offered on a PlayStation seat", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();

    expect(add()).toBeTruthy();
    expect(drop()).toBeTruthy();
    expect(screen.getByText(/2 \/ 4/)).toBeTruthy();
  });

  test("are offered even before a second pad exists", async () => {
    // A control that only appears once you have used it is a control nobody
    // finds.
    repo.listActive.mockResolvedValue([{ ...ps, joystick_count: 1, joysticks: [] }]);
    await mount();

    expect(add()).toBeTruthy();
  });

  test("are absent on a seat that has none", async () => {
    // A computer. The seat says so itself; the tile does not guess.
    repo.listActive.mockResolvedValue([{ ...ps, supports_joysticks: false }]);
    await mount();

    expect(screen.queryByRole("button", { name: "session.joystickAddHere" })).toBeNull();
  });

  test("are absent when the backend did not say", async () => {
    // An older payload with no field. Not drawing them is the safe direction:
    // a missing answer must not offer an operation the seat cannot take.
    repo.listActive.mockResolvedValue([{ ...ps, supports_joysticks: undefined }]);
    await mount();

    expect(screen.queryByRole("button", { name: "session.joystickAddHere" })).toBeNull();
  });

  test("adding calls the endpoint the dialog calls", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();

    await act(async () => { fireEvent.click(add()); });

    expect(repo.addJoystick).toHaveBeenCalledWith(42);
  });

  test("removing names the highest pad in play", async () => {
    repo.listActive.mockResolvedValue([{ ...ps, joystick_count: 3, joysticks: [
      { id: 5, slot: 2, hourly_rate: 500, started_at: new Date().toISOString(), stopped_at: null },
      { id: 6, slot: 3, hourly_rate: 700, started_at: new Date().toISOString(), stopped_at: null },
      { id: 7, slot: 4, hourly_rate: 700, started_at: new Date().toISOString(), stopped_at: "2026-01-01T00:00:00Z" },
    ] }]);
    await mount();

    await act(async () => { fireEvent.click(drop()); });

    // Slot 3: the last one still out. Slot 4 has already come back.
    expect(repo.removeJoystick).toHaveBeenCalledWith(42, 3);
  });

  test("cannot remove the session's own pad", async () => {
    repo.listActive.mockResolvedValue([{ ...ps, joystick_count: 1, joysticks: [] }]);
    await mount();

    // Slot 1 IS the session and has no row to remove.
    expect(drop().disabled).toBe(true);
  });

  test("cannot add a fifth", async () => {
    repo.listActive.mockResolvedValue([{ ...ps, joystick_count: 4 }]);
    await mount();

    expect(add().disabled).toBe(true);
  });

  test("shows a refusal on the tile it came from", async () => {
    repo.listActive.mockResolvedValue([ps]);
    repo.addJoystick.mockRejectedValue(new Error("No price is set for joystick #3"));
    await mount();

    await act(async () => { fireEvent.click(add()); });

    expect(screen.getByText("No price is set for joystick #3")).toBeTruthy();
  });
});
