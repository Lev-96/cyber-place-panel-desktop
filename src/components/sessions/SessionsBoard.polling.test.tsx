// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import SessionsBoard from "./SessionsBoard";

/**
 * The board's 30-second poll is the ONLY thing that repairs it when a socket
 * frame never arrives, and it had never once fired.
 *
 * `useAsync` returns `{ ...state, reload }` — a fresh object every render — so
 * an effect keyed on `[sessions, pcs]` tore the interval down and built a new
 * one on every re-render. The board re-renders every ten seconds on its own
 * (`usePs5Control` → `useConsoleWatch`'s ten-second probe), so the thirty
 * seconds were never reached.
 *
 * This test reproduces the re-render, not the PS5 provider: what the bug turns
 * on is "something above re-renders the board faster than the poll period",
 * and mocking the specific cause would let the same bug back in from any other
 * caller. `Ticker` is that something.
 *
 * Mutation-verified: put `[sessions, pcs]` back on the interval effect in
 * `SessionsBoard` and this goes red.
 */

const repo = vi.hoisted(() => ({
  listPcs: vi.fn(), listActive: vi.fn(), preview: vi.fn(),
  addJoystick: vi.fn(), removeJoystick: vi.fn(),
}));

vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
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
const availability = vi.hoisted(() => ({
  handler: null as null | ((e: { reason: string }) => void),
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({
  usePlaceAvailability: (_b: unknown, onChange: (e: { reason: string }) => void) => {
    availability.handler = onChange;
  },
}));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
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

const running = {
  id: 42,
  branch_id: 7,
  pc_id: 1,
  pc_label: "PS4-08",
  mode: "fixed",
  status: "active",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ends_at: new Date(Date.now() + 20 * 60_000).toISOString(),
  hourly_rate: null,
  committed_amount: 250,
  total_paid: 250,
  is_free: false,
} as ISessionApi;

/** Something above the board that re-renders it every ten seconds. */
const Ticker = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  return <SessionsBoard branchId={7} />;
};

describe("the board's self-healing poll", () => {
  beforeEach(() => {
    repo.listPcs.mockResolvedValue([device]);
    repo.listActive.mockResolvedValue([running]);
    repo.preview.mockResolvedValue({
      mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 10,
      time_cost: 250, hourly_rate: 1500, package_name: "10m", items: [], items_total: 0,
      joysticks: [], joysticks_total: 0, subtotal: 250, gross_total: 250, total: 250,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  test("still fires when something above re-renders the board faster than the poll period", async () => {
    await act(async () => {
      render(
        <ConfirmProvider>
          <MemoryRouter>
            <Ticker />
          </MemoryRouter>
        </ConfirmProvider>,
      );
    });

    const afterMount = repo.listActive.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    // Advanced in SEPARATE `act` blocks, and that is load-bearing. Inside one
    // long advance React flushes the re-render's effects only when the block
    // ends, so the interval is never actually re-armed mid-flight and the bug
    // is invisible — the first version of this test passed with the defect put
    // back. A tick per `act` is what makes each re-render land before the next
    // timer is due.
    for (let elapsed = 0; elapsed < 30_000; elapsed += 10_000) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(
      repo.listActive.mock.calls.length,
      "the 30s poll never fired: it was re-armed by every re-render, so the board has no fallback " +
        "when a socket frame is missed",
    ).toBeGreaterThan(afterMount);
  });
});

/**
 * One change, one refetch.
 *
 * The backend announces a session change to BOTH audiences — the staff
 * `session.changed` and the players' `place.availability.changed` — and this
 * board listens to both. Reloading on each meant a single "+10 minutes"
 * produced three GETs per open panel. The booking half of the same event is
 * the only thing that reaches the board this way, so that half must still act.
 */
describe("the board does not answer the same change twice", () => {
  beforeEach(() => {
    availability.handler = null;
  });

  const mount = async () => {
    await act(async () => {
      render(
        <ConfirmProvider>
          <MemoryRouter>
            <SessionsBoard branchId={7} />
          </MemoryRouter>
        </ConfirmProvider>,
      );
    });
  };

  test("ignores the players' echo of a session change", async () => {
    await mount();
    const before = repo.listActive.mock.calls.length;

    await act(async () => {
      availability.handler?.({ reason: "session.time.added" });
      availability.handler?.({ reason: "session.stopped" });
    });

    expect(
      repo.listActive.mock.calls.length,
      "the board refetched for a change `useSessionChanged` already covers",
    ).toBe(before);
  });

  test("…but still acts on a booking, which reaches it no other way", async () => {
    await mount();
    const before = repo.listActive.mock.calls.length;

    await act(async () => {
      availability.handler?.({ reason: "booking" });
    });

    expect(repo.listActive.mock.calls.length).toBeGreaterThan(before);
  });
});
