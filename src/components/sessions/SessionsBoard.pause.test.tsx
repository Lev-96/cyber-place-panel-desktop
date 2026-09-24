// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * Pause ↔ Resume on the tile. The SERVER decides and answers with the row;
 * the tile takes the pause at once — so the button flips on the press, not a
 * board read later — and re-reads the board as every action here does. A
 * refusal (another cashier got there first) is shown on the tile.
 */

const repo = vi.hoisted(() => ({
  listPcs: vi.fn(), listActive: vi.fn(), pause: vi.fn(), resume: vi.fn(),
}));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    pause: (...a: unknown[]) => repo.pause(...a),
    resume: (...a: unknown[]) => repo.resume(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import SessionsBoard from "./SessionsBoard";

const pc = (): IPcApi => ({
  id: 1, branch_id: 7, place_id: 10, label: "PC 1",
  kind: PC_KIND.Pc, status: PC_STATUS.InSession,
  place: { id: 10, number: 1, name: "PC 1", type: "standard", platform: "pc" },
} as IPcApi);

const running = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 5, pc_id: 1, branch_id: 7, status: "active", mode: "fixed",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ends_at: new Date(Date.now() + 50 * 60_000).toISOString(),
  hourly_rate: null, total_paid: 1500, committed_amount: 1500,
  time_package: { duration_minutes: 60, price: 1500 },
  items: [], joysticks: [], supports_joysticks: false, extra_item: null,
  paused_at: null, pauses: [],
  ...over,
} as unknown as ISessionApi);

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>);
  });
};
const buttons = () => [...document.querySelectorAll("button")].map((b) => b.textContent ?? "");
const press = async (label: string) => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent === label)!;
  await act(async () => { b.click(); });
};

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([pc()]);
  repo.listActive.mockReset();
  repo.pause.mockReset();
  repo.resume.mockReset();
  localStorage.clear();
});

describe("SessionsBoard — pause and resume", () => {
  test("a running seat offers Pause and Add time", async () => {
    repo.listActive.mockResolvedValue([running()]);
    await mount();

    expect(buttons()).toContain("session.pause");
    expect(buttons()).toContain("session.addTime");
    expect(document.body.textContent).not.toContain("session.pausedBadge");
  });

  test("a paused seat offers Resume, says it is paused and hides Add time", async () => {
    const pausedAt = new Date().toISOString();
    repo.listActive.mockResolvedValue([running({ paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null }] })]);
    await mount();

    expect(buttons()).toContain("session.resume");
    expect(buttons()).not.toContain("session.addTime");
    expect(document.body.textContent).toContain("session.pausedBadge");
  });

  test("Pause flips to Resume on the press, from the server's answer", async () => {
    const pausedAt = new Date().toISOString();
    repo.listActive
      .mockResolvedValueOnce([running()])
      // The follow-up read never lands: only the write's answer can flip it.
      .mockReturnValue(new Promise(() => {}));
    repo.pause.mockResolvedValue(running({ paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null }] }));
    await mount();

    await press("session.pause");

    expect(repo.pause).toHaveBeenCalledWith(5);
    expect(buttons()).toContain("session.resume");
  });

  test("Resume flips back and moves the end the server moved", async () => {
    const pausedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const newEnd = new Date(Date.now() + 55 * 60_000).toISOString();
    repo.listActive
      .mockResolvedValueOnce([running({ paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null }] })])
      .mockReturnValue(new Promise(() => {}));
    repo.resume.mockResolvedValue(running({
      paused_at: null, ends_at: newEnd,
      pauses: [{ paused_at: pausedAt, resumed_at: new Date().toISOString() }],
    }));
    await mount();

    await press("session.resume");

    expect(repo.resume).toHaveBeenCalledWith(5);
    expect(buttons()).toContain("session.pause");
    // The new end is 55 minutes out; a second may pass before the render.
    expect(document.body.textContent).toMatch(/5[45]:[0-5]\d/);
  });

  test("a refusal is shown on the tile and changes nothing", async () => {
    repo.listActive.mockResolvedValue([running()]);
    repo.pause.mockRejectedValue(new Error("already paused"));
    await mount();

    await press("session.pause");

    expect(document.body.textContent).toContain("already paused");
    expect(buttons()).toContain("session.pause");
  });

  test("a double press sends one request", async () => {
    repo.listActive.mockResolvedValue([running()]);
    let release: (v: ISessionApi) => void = () => {};
    repo.pause.mockReturnValue(new Promise<ISessionApi>((r) => { release = r; }));
    await mount();

    const b = [...document.querySelectorAll("button")].find((x) => x.textContent === "session.pause")!;
    await act(async () => { b.click(); b.click(); });

    expect(repo.pause).toHaveBeenCalledTimes(1);
    await act(async () => { release(running()); });
  });
});
