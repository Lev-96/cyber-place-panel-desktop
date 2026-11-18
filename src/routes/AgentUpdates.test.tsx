// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AgentBranchStatus, AgentUpdateStatus } from "@/api/agent-updates";
import { UpdatesNotificationProvider, useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { updateBadgeCounts } from "@/realtime/updateBadges";

/**
 * «Обновления агента» per branch (2026-11-17).
 *
 *  - One card per branch whose computers run the Agent and connected recently
 *    (`agent_relevant`, the server's word). A branch with consoles only, or with
 *    a computer that never connected, shows nothing about the Agent.
 *  - No such branch: no Agent block at all — only the app's own update card.
 *  - «Применить в этом филиале» sends THAT branch, and the side menu's badge
 *    clears at once: the screen asks the shared updates context to read again
 *    instead of leaving the badge to the next 60-second tick.
 */
const api = vi.hoisted(() => ({ status: vi.fn(), apply: vi.fn() }));
vi.mock("@/api/agent-updates", () => ({
  apiAgentUpdateStatus: () => api.status(),
  apiAgentUpdateApply: (branchId: number) => api.apply(branchId),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
vi.mock("@/realtime/useRealtimeVersion", () => ({ useRealtimeVersion: () => 0 }));
vi.mock("@/realtime/echo", () => ({ getEcho: () => null }));

import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import AgentUpdates from "./AgentUpdates";

const branchA: AgentBranchStatus = {
  branch_id: 11, address: "Abovyan 1", agent_relevant: true,
  agent: { pc_count: 3, pending_pc_count: 2, pending: true },
};
const branchB: AgentBranchStatus = { branch_id: 12, address: "Komitas 5", agent_relevant: false, agent: null };

const status = (over: Partial<AgentUpdateStatus> = {}): AgentUpdateStatus => ({
  current: null, available: null, has_update: true, error: null,
  approved: { version: "1.0.27", github_tag: "v1.0.27", mandatory: false },
  venue_pc_count: 3, applied_version: null,
  branches: [branchA, branchB],
  pending_branch_count: 1,
  ...over,
});

/** The side menu's agent badge, read from the same context the Sidebar reads. */
const BadgeProbe = () => (
  <div data-testid="badge">{updateBadgeCounts(useUpdatesNotification()).agentUpdates}</div>
);

const mount = async () => {
  await act(async () => {
    render(
      <ConfirmProvider>
        <UpdatesNotificationProvider>
          <BadgeProbe />
          <AgentUpdates />
        </UpdatesNotificationProvider>
      </ConfirmProvider>,
    );
  });
};
const card = (branchId: number) => screen.queryByTestId(`agent-branch-${branchId}`);

beforeEach(() => {
  api.status.mockReset();
  api.apply.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("one card per branch the Agent concerns", () => {
  test("A: its address, the approved version, how many are left of how many, and the button", async () => {
    api.status.mockResolvedValue(status());
    await mount();

    const a = card(11)!;
    expect(a).not.toBeNull();
    expect(within(a).getByText("Abovyan 1")).toBeTruthy();
    expect(within(a).getByText("1.0.27")).toBeTruthy();
    expect(within(a).getByText("Computers to update: 2 of 3")).toBeTruthy();
    expect(within(a).getByRole("button", { name: "Apply in this branch" })).toBeTruthy();
  });

  test("B, without a connected computer, shows nothing about the Agent", async () => {
    api.status.mockResolvedValue(status());
    await mount();

    expect(card(12)).toBeNull();
    expect(screen.queryByText("Komitas 5")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Apply in this branch" })).toHaveLength(1);
  });

  test("a branch whose computers all got the version says so and offers no button", async () => {
    api.status.mockResolvedValue(status({
      branches: [{ ...branchA, agent: { pc_count: 3, pending_pc_count: 0, pending: false } }],
      pending_branch_count: 0,
    }));
    await mount();

    const a = card(11)!;
    expect(within(a).getByText("All computers have received the update.")).toBeTruthy();
    expect(within(a).queryByRole("button")).toBeNull();
  });

  test("before an administrator approves anything there is nothing to apply", async () => {
    api.status.mockResolvedValue(status({
      approved: null,
      branches: [{ ...branchA, agent: { pc_count: 3, pending_pc_count: 0, pending: false } }],
      pending_branch_count: 0,
    }));
    await mount();

    expect(screen.getByText(/No update has been approved by an administrator yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply in this branch" })).toBeNull();
  });
});

describe("no branch the Agent concerns", () => {
  test("no Agent block at all: no card, no version, no button", async () => {
    api.status.mockResolvedValue(status({ branches: [branchB], pending_branch_count: 0, venue_pc_count: 0 }));
    await mount();

    expect(card(12)).toBeNull();
    expect(screen.queryByText("1.0.27")).toBeNull();
    expect(screen.queryByRole("button", { name: "Apply in this branch" })).toBeNull();
    // Nothing about the Agent at all (2026-11-17, owner) — not even an empty
    // state; the app's own update card is what the screen shows.
    expect(screen.queryByTestId("agent-updates-block")).toBeNull();
    expect(screen.queryByText("No connected computers")).toBeNull();
    expect(screen.getByTestId("desktop-update-card")).toBeTruthy();
  });

  test("a branch with a computer: the Agent block is there, below the app's card", async () => {
    api.status.mockResolvedValue(status());
    await mount();
    expect(screen.getByTestId("desktop-update-card")).toBeTruthy();
    expect(screen.getByTestId("agent-updates-block")).toBeTruthy();
  });
});

describe("applying in a branch", () => {
  test("sends that branch, and the badge clears at once, not on the next poll", async () => {
    api.status.mockResolvedValue(status());
    await mount();
    expect(screen.getByTestId("badge").textContent).toBe("1");

    // From now on the server has nothing pending.
    api.status.mockResolvedValue(status({
      branches: [{ ...branchA, agent: { pc_count: 3, pending_pc_count: 0, pending: false } }, branchB],
      pending_branch_count: 0, has_update: false, applied_version: "1.0.27",
    }));
    api.apply.mockResolvedValue({ data: null, applied_pc_count: 3, version: "1.0.27", applied_branch_ids: [11] });

    await act(async () => {
      fireEvent.click(within(card(11)!).getByRole("button", { name: "Apply in this branch" }));
    });

    expect(api.apply).toHaveBeenCalledWith(11);
    // No timer was advanced: only an immediate re-read can have cleared it.
    expect(screen.getByTestId("badge").textContent).toBe("0");
    expect(within(card(11)!).getByText("All computers have received the update.")).toBeTruthy();
  });

  test("a refusal stays on that branch's card, in the server's words, and the badge stays", async () => {
    api.status.mockResolvedValue(status());
    await mount();
    api.apply.mockRejectedValue(Object.assign(new Error("This action is unauthorized."), { status: 403, body: { message: "This action is unauthorized." } }));

    await act(async () => {
      fireEvent.click(within(card(11)!).getByRole("button", { name: "Apply in this branch" }));
    });

    expect(within(card(11)!).getByText("This action is unauthorized.")).toBeTruthy();
    expect(screen.getByTestId("badge").textContent).toBe("1");
  });
});
