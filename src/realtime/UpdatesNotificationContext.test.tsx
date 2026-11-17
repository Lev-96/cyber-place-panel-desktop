// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AgentUpdateStatus } from "@/api/agent-updates";
import { UpdatesNotificationProvider, useUpdatesNotification } from "./UpdatesNotificationContext";
import { updateBadgeCounts } from "./updateBadges";

/**
 * What the update badge and toast read (2026-11-17).
 *
 *  - An owner or a manager is shown the SERVER's count of pending branches,
 *    as sent. It used to be worked out here from `applied_version`, a record
 *    kept per PERSON, so a manager who joined after the owner had applied was
 *    told to apply all over again.
 *  - The admin keeps the GitHub-based check, unchanged.
 *  - Leaving takes away exactly what this provider added: its own focus and
 *    visibility listeners, and its own handler on the role channel, which it
 *    never leaves (realtime rule 9).
 */
const api = vi.hoisted(() => ({ status: vi.fn(), check: vi.fn() }));
vi.mock("@/api/agent-updates", () => ({ apiAgentUpdateStatus: () => api.status() }));
vi.mock("@/api/updates", () => ({ apiCheckUpdates: () => api.check() }));

const auth = vi.hoisted(() => ({ value: { user: { id: 3, role: "company_owner" } } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/realtime/useRealtimeVersion", () => ({ useRealtimeVersion: () => 0 }));

type Handler = (e: unknown) => void;
const echo = vi.hoisted(() => {
  const channels = new Map<string, { listen: (e: string, h: Handler) => unknown; stopListening: (e: string, h?: Handler) => unknown; handlers: Map<string, Set<Handler>>; stopCalls: Array<[string, Handler | undefined]> }>();
  const channel = (name: string) => {
    if (!channels.has(name)) {
      const handlers = new Map<string, Set<Handler>>();
      const stopCalls: Array<[string, Handler | undefined]> = [];
      channels.set(name, {
        handlers,
        stopCalls,
        listen(e, h) { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e)!.add(h); return this; },
        stopListening(e, h) { stopCalls.push([e, h]); if (h) handlers.get(e)?.delete(h); else handlers.delete(e); return this; },
      });
    }
    return channels.get(name)!;
  };
  return { channels, channel, left: [] as string[], leaveChannel(name: string) { this.left.push(name); } };
});
vi.mock("@/realtime/echo", () => ({ getEcho: () => echo }));

const status = (over: Partial<AgentUpdateStatus> = {}): AgentUpdateStatus => ({
  current: null,
  available: null,
  has_update: false,
  error: null,
  approved: { version: "1.0.27", github_tag: "v1.0.27", mandatory: false },
  venue_pc_count: 3,
  applied_version: "1.0.27",
  branches: [],
  pending_branch_count: 0,
  ...over,
});

const Probe = () => {
  const state = useUpdatesNotification();
  const badges = updateBadgeCounts(state);
  return <div data-testid="probe">{`${badges.updates}|${badges.agentUpdates}`}</div>;
};
const probe = () => screen.getByTestId("probe").textContent;

const mount = async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<UpdatesNotificationProvider><Probe /></UpdatesNotificationProvider>);
  });
  return view;
};

beforeEach(() => {
  api.status.mockReset();
  api.check.mockReset();
  echo.channels.clear();
  echo.left = [];
  auth.value = { user: { id: 3, role: "company_owner" } };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("owner / manager: the server's count, as sent", () => {
  test("the badge is pending_branch_count, never recounted from the branches or the legacy flags", async () => {
    // Deliberately inconsistent: one branch flagged pending in the list, the
    // legacy fields saying "nothing to do", and a count of 3. Only the count
    // is the server's answer to "how many branches", and it is printed as is.
    api.status.mockResolvedValue(status({
      pending_branch_count: 3,
      has_update: false,
      applied_version: "1.0.27",
      branches: [
        { branch_id: 4, address: "Abovyan 1", agent_relevant: true, agent: { pc_count: 2, pending_pc_count: 1, pending: true } },
      ],
    }));

    await mount();

    expect(probe()).toBe("0|3");
  });

  test("a manager who joined after the owner applied sees no badge: the server says nothing is pending", async () => {
    auth.value = { user: { id: 8, role: "manager" } };
    api.status.mockResolvedValue(status({
      pending_branch_count: 0,
      // What the per-person record used to look like for this manager.
      applied_version: null,
      branches: [
        { branch_id: 4, address: "Abovyan 1", agent_relevant: true, agent: { pc_count: 2, pending_pc_count: 0, pending: false } },
      ],
    }));

    await mount();

    expect(probe()).toBe("0|0");
  });

  test("an answer without the count (an older backend) shows no badge rather than a guess", async () => {
    api.status.mockResolvedValue({ ...status(), pending_branch_count: undefined } as unknown as AgentUpdateStatus);

    await mount();

    expect(probe()).toBe("0|0");
  });
});

describe("switching to another account of the same role", () => {
  /**
   * An account switch keeps this provider mounted (the user changes, never to
   * null), and the answer names branches by address: the next account must
   * never be shown the previous one's, neither while its own is on the way
   * nor when the previous one's request lands late.
   */
  test("forgets the previous account's answer and asks again at once", async () => {
    const first = status({ pending_branch_count: 2, branches: [] });
    api.status.mockResolvedValue(first);
    const view = await mount();
    expect(probe()).toBe("0|2");

    let release!: (s: AgentUpdateStatus) => void;
    api.status.mockImplementation(() => new Promise<AgentUpdateStatus>((resolve) => { release = resolve; }));
    auth.value = { user: { id: 4, role: "company_owner" } };
    await act(async () => {
      view.rerender(<UpdatesNotificationProvider><Probe /></UpdatesNotificationProvider>);
    });

    expect(probe(), "the previous account's count survived the switch").toBe("0|0");
    expect(api.status).toHaveBeenCalledTimes(2);

    await act(async () => { release(status({ pending_branch_count: 5, branches: [] })); });
    expect(probe()).toBe("0|5");
  });

  test("an answer asked for by the previous account is dropped when it lands", async () => {
    let releaseFirst!: (s: AgentUpdateStatus) => void;
    api.status.mockImplementationOnce(() => new Promise<AgentUpdateStatus>((resolve) => { releaseFirst = resolve; }));
    const view = await mount();

    api.status.mockResolvedValue(status({ pending_branch_count: 0, branches: [] }));
    auth.value = { user: { id: 4, role: "company_owner" } };
    await act(async () => {
      view.rerender(<UpdatesNotificationProvider><Probe /></UpdatesNotificationProvider>);
    });
    await act(async () => { releaseFirst(status({ pending_branch_count: 7, branches: [] })); });

    expect(probe(), "a late answer for the previous account was shown to this one").toBe("0|0");
  });
});

describe("admin: unchanged", () => {
  test("keeps the GitHub-based check and counts one per app with something to promote", async () => {
    auth.value = { user: { id: 1, role: "admin" } };
    const entry = { current: null, available: null, has_update: true, error: null };
    api.check.mockResolvedValue({ panel: entry, agent: entry });

    await mount();

    expect(api.status).not.toHaveBeenCalled();
    expect(probe()).toBe("2|0");
  });
});

describe("leaving takes away exactly what was added", () => {
  test("the visibility listener is removed with the focus one", async () => {
    api.status.mockResolvedValue(status());
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");

    const view = await mount();
    const listener = added.mock.calls.find(([type]) => type === "visibilitychange")?.[1];
    expect(listener, "the provider listens for the window coming back").toBeTypeOf("function");

    view.unmount();

    expect(
      removed.mock.calls.some(([type, fn]) => type === "visibilitychange" && fn === listener),
      "the visibilitychange listener outlived the provider",
    ).toBe(true);
  });

  test("the role channel keeps its other listeners and is never left", async () => {
    api.status.mockResolvedValue(status());
    const sibling = vi.fn();
    echo.channel("app-updates.company_owner").listen(".app-release.available", sibling);

    const view = await mount();
    const ownChannel = echo.channel("app-updates.company_owner");
    expect(ownChannel.handlers.get(".app-release.available")?.size).toBe(2);

    view.unmount();

    expect(echo.left, "leaving a shared channel deafens every other subscriber").toEqual([]);
    expect(ownChannel.stopCalls.every(([, handler]) => typeof handler === "function"), "stopListening without a handler removes everybody's").toBe(true);
    expect([...ownChannel.handlers.get(".app-release.available") ?? []]).toEqual([sibling]);
  });
});
