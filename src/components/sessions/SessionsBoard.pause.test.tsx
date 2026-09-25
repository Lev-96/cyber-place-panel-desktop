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
  preview: vi.fn(), stop: vi.fn(),
}));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    pause: (...a: unknown[]) => repo.pause(...a),
    resume: (...a: unknown[]) => repo.resume(...a),
    preview: (...a: unknown[]) => repo.preview(...a),
    stop: (...a: unknown[]) => repo.stop(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k.startsWith("session.toast") ? `${k} {0}` : k),
    money: (n: number) => String(n),
    lang: "en",
  }),
}));

import SessionsBoard from "./SessionsBoard";
import { notify, ToastEvent } from "@/ui/notify";

/**
 * A button's ACCESSIBLE name — what a screen reader announces and what the
 * card's tooltip says. The session card shows a short label ("+ Время") and
 * names the button in full ("Добавить время"), so tests find buttons by what
 * they do, not by how the card abbreviates it.
 */
const nameOf = (b: Element): string => b.getAttribute("aria-label") ?? b.textContent ?? "";

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
const buttons = () => [...document.querySelectorAll("button")].map(nameOf);
const press = async (label: string) => {
  const b = [...document.querySelectorAll("button")].find((x) => nameOf(x) === label)!;
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
    // A pause belongs to the seat it began on: no move until it is resumed.
    expect(buttons()).not.toContain("session.relocate");
  });

  test("the card shows SHORT labels, each button named by its full action", async () => {
    repo.listActive.mockResolvedValue([running()]);
    await mount();

    const named = (name: string) => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === name)!;
    expect(named("session.addTime").textContent).toBe("session.card.addTime");
    expect(named("session.addItem").textContent).toBe("session.card.addItem");
    expect(named("session.relocate").textContent).toBe("session.card.relocate");
    expect(named("session.addTime").getAttribute("title")).toBe("session.addTime");
    // «Пересадить» spans the row like Stop; the half-width actions do not.
    expect(named("session.relocate").classList.contains("session-card__btn--wide")).toBe(true);
    expect(named("action.stop").classList.contains("session-card__btn--wide")).toBe(true);
    expect(named("session.addTime").classList.contains("session-card__btn--wide")).toBe(false);
  });

  test("a running seat offers «Move player»", async () => {
    repo.listActive.mockResolvedValue([running()]);
    await mount();

    expect(buttons()).toContain("session.relocate");
  });

  test("a limited pause says until when, from the server's instant", async () => {
    const pausedAt = new Date().toISOString();
    const until = new Date(Date.now() + 10 * 60_000).toISOString();
    repo.listActive.mockResolvedValue([running({
      paused_at: pausedAt,
      pauses: [{ paused_at: pausedAt, resumed_at: null, auto_resume_at: until }],
    })]);
    await mount();

    expect(document.body.textContent).toContain("session.pausedUntil");
    expect(document.body.textContent).not.toContain("session.pausedBadge");
    expect(document.querySelector('[data-testid="auto-resume"]')).not.toBeNull();
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

    const b = [...document.querySelectorAll("button")].find((x) => nameOf(x) === "session.pause")!;
    await act(async () => { b.click(); b.click(); });

    expect(repo.pause).toHaveBeenCalledTimes(1);
    await act(async () => { release(running()); });
  });
});

/**
 * Each of the three presses is announced — only once the server accepted it,
 * naming the seat as its tile does (`№1`): amber for a pause, green for the
 * clock running again, red for the session ending. A refusal raises nothing;
 * its sentence stays on the tile.
 */
describe("SessionsBoard — the toasts after stop, pause and resume", () => {
  const toasts: ToastEvent[] = [];
  let off: () => void = () => {};
  beforeEach(() => { toasts.length = 0; off = notify.subscribe((e) => toasts.push(e)); });
  afterEach(() => off());

  test("a pause raises an amber toast naming the seat", async () => {
    const pausedAt = new Date().toISOString();
    repo.listActive.mockResolvedValue([running()]);
    repo.pause.mockResolvedValue(running({ paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null }] }));
    await mount();

    await press("session.pause");

    expect(toasts).toEqual([expect.objectContaining({ kind: "warning", text: "session.toastPaused №1" })]);
  });

  test("a resume raises a green one", async () => {
    const pausedAt = new Date().toISOString();
    repo.listActive.mockResolvedValue([running({ paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null }] })]);
    repo.resume.mockResolvedValue(running());
    await mount();

    await press("session.resume");

    expect(toasts).toEqual([expect.objectContaining({ kind: "success", text: "session.toastResumed №1" })]);
  });

  test("a refused pause raises nothing", async () => {
    repo.listActive.mockResolvedValue([running()]);
    repo.pause.mockRejectedValue(new Error("already paused"));
    await mount();

    await press("session.pause");

    expect(toasts).toEqual([]);
  });

  test("a confirmed stop raises a red one; a cancelled stop raises nothing", async () => {
    repo.listActive.mockResolvedValue([running()]);
    repo.preview.mockResolvedValue({
      mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 10,
      time_cost: 250, hourly_rate: 1500, package_name: "1h", items: [], items_total: 0,
      joysticks: [], joysticks_total: 0, subtotal: 250, gross_total: 250, total: 250,
    });
    repo.stop.mockResolvedValue({
      session: running({ status: "stopped" }),
      breakdown: {
        mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 10,
        time_cost: 250, hourly_rate: 1500, package_name: "1h", items: [], items_total: 0,
        joysticks: [], joysticks_total: 0, subtotal: 250, gross_total: 250, total: 250,
      },
    });
    await mount();

    await press("action.stop");
    await press("action.cancel");
    expect(toasts).toEqual([]);

    await press("action.stop");
    await press("session.confirmStop");

    expect(repo.stop).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual([expect.objectContaining({ kind: "error", text: "session.toastStopped №1" })]);
  });

  test("a refused stop raises nothing", async () => {
    repo.listActive.mockResolvedValue([running()]);
    repo.preview.mockResolvedValue({
      mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 10,
      time_cost: 250, hourly_rate: 1500, package_name: "1h", items: [], items_total: 0,
      joysticks: [], joysticks_total: 0, subtotal: 250, gross_total: 250, total: 250,
    });
    repo.stop.mockRejectedValue(new Error("not active"));
    await mount();

    await press("action.stop");
    await press("session.confirmStop");

    expect(toasts).toEqual([]);
  });
});
