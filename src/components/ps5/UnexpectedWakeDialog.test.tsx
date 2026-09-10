// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The question the owner is asked, and the three ways it ends.
 *
 * The rules with teeth: a manager never sees it, "yes" and "no" are recorded as
 * what they are, and nobody answering is recorded as nobody answering — a
 * different fact from a refusal, and the one that tells you whether the owner
 * was at the desk.
 */

const decide = vi.hoisted(() => vi.fn(async () => ({ wake_event: {} })));
const expire = vi.hoisted(() => vi.fn(async () => ({ wake_event: {} })));
const pending = vi.hoisted(() => ({ data: [] as unknown[], calls: 0 }));
const subscribers = vi.hoisted(() => ({ current: [] as Array<(e: unknown) => void>, owner: null as number | null }));

vi.mock("@/api/ps5", () => ({
  apiDecideWakeEvent: (...a: unknown[]) => decide(...(a as [])),
  apiExpireWakeEvent: (...a: unknown[]) => expire(...(a as [])),
  apiPendingWakeEvents: async () => { pending.calls += 1; return pending; },
}));

vi.mock("@/realtime/usePs5Realtime", () => ({
  usePs5UnexpectedWake: (ownerUserId: number | null, onEvent: (e: unknown) => void) => {
    subscribers.owner = ownerUserId;
    subscribers.current = [onEvent];
  },
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const role = vi.hoisted(() => ({ current: "company_owner" as string }));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, role: role.current } }),
}));

const wake = (over: Record<string, unknown> = {}) => ({
  id: 42,
  event_uuid: "u-1",
  device_id: 3,
  branch_id: 1,
  place_label: "№501 · PS5 VIP",
  grace_seconds: 10,
  ...over,
});

let UnexpectedWakeDialog: typeof import("./UnexpectedWakeDialog").default;

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  decide.mockClear();
  expire.mockClear();
  role.current = "company_owner";
  pending.data = [];
  pending.calls = 0;
  subscribers.current = [];
  ({ default: UnexpectedWakeDialog } = await import("./UnexpectedWakeDialog"));
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

const fire = (event: unknown) => act(() => { subscribers.current.forEach((s) => s(event)); });

describe("who is asked", () => {
  test("a manager is never asked, and never even subscribes", () => {
    role.current = "manager";

    render(<UnexpectedWakeDialog />);

    // Not merely hidden: the manager's panel does not listen for the question
    // at all, so it cannot learn that the owner is being asked one.
    expect(subscribers.owner).toBeNull();
    fire(wake());
    expect(screen.queryByText("ps5.wake.dialogTitle")).toBeNull();
  });

  test("the owner is asked, and the place is named", () => {
    render(<UnexpectedWakeDialog />);

    fire(wake());

    expect(screen.getByText("ps5.wake.dialogTitle")).toBeTruthy();
    expect(screen.getByText("№501 · PS5 VIP")).toBeTruthy();
  });
});

describe("the three ways it ends", () => {
  test("yes is recorded as an approval", async () => {
    render(<UnexpectedWakeDialog />);
    fire(wake());

    act(() => { fireEvent.click(screen.getByText("ps5.wake.yes")); });

    await waitFor(() => expect(decide).toHaveBeenCalledWith(42, true));
    await waitFor(() => expect(screen.queryByText("ps5.wake.dialogTitle")).toBeNull());
  });

  test("no is recorded as a refusal", async () => {
    render(<UnexpectedWakeDialog />);
    fire(wake());

    act(() => { fireEvent.click(screen.getByText("ps5.wake.no")); });

    await waitFor(() => expect(decide).toHaveBeenCalledWith(42, false));
  });

  test("nobody answering is recorded as expired, not as a refusal", async () => {
    render(<UnexpectedWakeDialog />);
    fire(wake());

    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    // The distinction matters when somebody reads the history: an owner who
    // said no was at the desk; an owner who expired was not.
    await waitFor(() => expect(expire).toHaveBeenCalledWith(42));
    expect(decide).not.toHaveBeenCalled();
  });

  test("a double click answers once", async () => {
    render(<UnexpectedWakeDialog />);
    fire(wake());

    act(() => {
      fireEvent.click(screen.getByText("ps5.wake.yes"));
      fireEvent.click(screen.getByText("ps5.wake.yes"));
    });

    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
  });
});

describe("a question nobody was listening for", () => {
  test("it still reaches the owner", async () => {
    // The bug this exists for: a broadcast reaches whoever was listening at
    // that second. A console switched on while the owner was on another screen
    // raised a question that then waited, unanswered, for hours.
    pending.data = [{
      id: 77, event_uuid: "u-old", device_id: 3, branch_id: 1,
      decision: "pending", detected_at: "2026-08-31T18:03:33.000000Z",
      place_label: "№1 · Плейстейшен 5",
    }];

    render(<UnexpectedWakeDialog />);

    await waitFor(() => expect(screen.getByText("№1 · Плейстейшен 5")).toBeTruthy());

    act(() => { fireEvent.click(screen.getByText("ps5.wake.yes")); });
    await waitFor(() => expect(decide).toHaveBeenCalledWith(77, true));
  });

  test("a manager is not shown one either", async () => {
    role.current = "manager";
    pending.data = [{
      id: 77, event_uuid: "u-old", device_id: 3, branch_id: 1,
      decision: "pending", detected_at: "2026-08-31T18:03:33.000000Z",
      place_label: "№1 · Плейстейшен 5",
    }];

    render(<UnexpectedWakeDialog />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(screen.queryByText("№1 · Плейстейшен 5")).toBeNull();
    // And does not ask for them at all: a manager's panel has no business
    // fetching a list of questions put to the owner, on any schedule.
    expect(pending.calls).toBe(0);
  });

  test("one already answered here is not asked again", async () => {
    // The list is fetched every minute; a question answered thirty seconds ago
    // is still pending on the server until that write lands.
    pending.data = [{
      id: 78, event_uuid: "u-1", device_id: 3, branch_id: 1,
      decision: "pending", detected_at: "2026-08-31T18:03:33.000000Z",
      place_label: "№1 · Плейстейшен 5",
    }];

    render(<UnexpectedWakeDialog />);
    await waitFor(() => expect(screen.getByText("№1 · Плейстейшен 5")).toBeTruthy());
    act(() => { fireEvent.click(screen.getByText("ps5.wake.no")); });
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));

    // The next minute's fetch brings the same row back.
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(decide).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("№1 · Плейстейшен 5")).toBeNull();
  });
});

describe("two consoles in the same minute", () => {
  test("the second question waits for the first to be answered", async () => {
    render(<UnexpectedWakeDialog />);

    fire(wake({ id: 42, event_uuid: "u-1", place_label: "№501 · PS5 VIP" }));
    fire(wake({ id: 43, event_uuid: "u-2", place_label: "№502 · PS5 Standard" }));

    // Stacking them would answer the second with the first one's click.
    expect(screen.getByText("№501 · PS5 VIP")).toBeTruthy();
    expect(screen.queryByText("№502 · PS5 Standard")).toBeNull();

    act(() => { fireEvent.click(screen.getByText("ps5.wake.yes")); });
    await waitFor(() => expect(screen.getByText("№502 · PS5 Standard")).toBeTruthy());

    act(() => { fireEvent.click(screen.getByText("ps5.wake.no")); });
    await waitFor(() => expect(decide).toHaveBeenCalledWith(43, false));
  });

  test("the countdown restarts for the second question", async () => {
    render(<UnexpectedWakeDialog />);
    fire(wake({ id: 42, event_uuid: "u-1" }));

    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    fire(wake({ id: 43, event_uuid: "u-2" }));
    act(() => { fireEvent.click(screen.getByText("ps5.wake.yes")); });

    // Two seconds later the FIRST question's clock would have run out. The
    // second must get its own ten, not the remainder of somebody else's.
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(expire).not.toHaveBeenCalled();
  });
});
