// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AgentBranchStatus, AgentUpdateStatus } from "@/api/agent-updates";

/**
 * The "new update" toast (2026-11-17).
 *
 *  - An owner or a manager is told WHERE: the pending branches by address,
 *    as the server marked them. A branch the server does not mark pending is
 *    never named.
 *  - Closing it is remembered per PERSON (`u{id}:`), per version and per
 *    branch. It used to be one device-wide key per version, so the next
 *    person to sign in on that computer was never told at all.
 *  - A branch that becomes pending later is announced even after the others
 *    were closed.
 *  - A close made before this build (the device-wide key) still holds for its
 *    version: an update installs and nobody is nagged twice.
 */
const auth = vi.hoisted(() => ({ user: { id: 1, role: "company_owner" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
vi.mock("@/sound/soundEngine", () => ({ playFor: vi.fn() }));
const updates = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => updates.value }));

import UpdatesToast from "./UpdatesToast";

const branch = (id: number, address: string, pending: boolean): AgentBranchStatus => ({
  branch_id: id, address, agent_relevant: true,
  agent: { pc_count: 2, pending_pc_count: pending ? 1 : 0, pending },
});

const rollout = (branches: AgentBranchStatus[], version = "1.0.27"): AgentUpdateStatus => ({
  current: null, available: null, has_update: true, error: null,
  approved: { version, github_tag: `v${version}`, mandatory: false },
  venue_pc_count: 4, applied_version: null,
  branches,
  pending_branch_count: branches.filter((b) => b.agent?.pending).length,
});

const show = (agentRollout: AgentUpdateStatus | null) => {
  updates.value = { panel: null, agent: null, agentRollout, reload: async () => {} };
};

const mount = () => render(<MemoryRouter><UpdatesToast /></MemoryRouter>);
const toast = () => screen.queryByRole("status");

beforeEach(() => {
  localStorage.clear();
  auth.user = { id: 1, role: "company_owner" };
});
afterEach(() => cleanup());

describe("owner / manager: where the update waits", () => {
  test("names the pending branches and only them", () => {
    show(rollout([branch(4, "Abovyan 1", true), branch(5, "Komitas 5", false), branch(6, "Tumanyan 9", true)]));
    mount();

    expect(toast()!.textContent).toContain("The kiosk Agent update is waiting in: Abovyan 1, Tumanyan 9");
    expect(toast()!.textContent).not.toContain("Komitas 5");
  });

  test("nothing pending, no toast", () => {
    show(rollout([branch(4, "Abovyan 1", false)]));
    mount();

    expect(toast()).toBeNull();
  });

  test("closing it is remembered for this person, this version and these branches", () => {
    show(rollout([branch(4, "Abovyan 1", true), branch(6, "Tumanyan 9", true)]));
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(toast()).toBeNull();
    expect(localStorage.getItem("u1:cp.update-toast-dismissed-agent-1.0.27-b4")).toBe("1");
    expect(localStorage.getItem("u1:cp.update-toast-dismissed-agent-1.0.27-b6")).toBe("1");
    // Nothing device-wide is written any more.
    expect(localStorage.getItem("cp.update-toast-dismissed-agent-1.0.27")).toBeNull();

    view.unmount();
    mount();
    expect(toast(), "the same person is not told again").toBeNull();
  });

  test("another person on the same computer is still told", () => {
    show(rollout([branch(4, "Abovyan 1", true)]));
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    view.unmount();

    auth.user = { id: 2, role: "manager" };
    mount();

    expect(toast()!.textContent).toContain("Abovyan 1");
  });

  test("a branch that becomes pending later is announced on its own", () => {
    show(rollout([branch(4, "Abovyan 1", true)]));
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    view.unmount();

    show(rollout([branch(4, "Abovyan 1", true), branch(7, "Sayat-Nova 3", true)]));
    mount();

    expect(toast()!.textContent).toContain("waiting in: Sayat-Nova 3");
    expect(toast()!.textContent).not.toContain("Abovyan 1");
  });

  test("a newer approved version is announced again for the same branch", () => {
    show(rollout([branch(4, "Abovyan 1", true)], "1.0.27"));
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    view.unmount();

    show(rollout([branch(4, "Abovyan 1", true)], "1.0.28"));
    mount();

    expect(toast()!.textContent).toContain("Abovyan 1");
  });

  test("a close made before this build still holds for its version", () => {
    localStorage.setItem("cp.update-toast-dismissed-agent-1.0.27", "1");
    show(rollout([branch(4, "Abovyan 1", true)], "1.0.27"));
    mount();

    expect(toast()).toBeNull();
  });
});

describe("admin: the same toast, remembered per person", () => {
  test("a panel release is announced and its close is kept under the admin's own key", () => {
    auth.user = { id: 9, role: "admin" };
    updates.value = {
      panel: { current: null, has_update: true, error: null, available: { version: "1.0.64", tag: "v1.0.64", name: null, body: null, published_at: null, html_url: "" } },
      agent: null,
      agentRollout: null,
      reload: async () => {},
    };
    mount();

    expect(toast()!.textContent).toContain("You have a new update for your desktop app.");
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Close" })); });
    expect(localStorage.getItem("u9:cp.update-toast-dismissed-panel-1.0.64")).toBe("1");
  });
});
