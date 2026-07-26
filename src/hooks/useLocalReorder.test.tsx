// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useLocalReorder } from "./useLocalReorder";

const auth = vi.hoisted(() => ({ user: null as { id: number } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

const KEYS = ["a", "b", "c"];

let latest: { ordered: string[]; move: (from: string, before: string | null) => void };

const Probe = () => {
  latest = useLocalReorder("hub:tiles:1", KEYS);
  return null;
};

const mount = () => render(<Probe />);

afterEach(() => cleanup());

describe("useLocalReorder — per-account isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    auth.user = null;
  });

  test("one account's arrangement is invisible to another on the same machine", async () => {
    auth.user = { id: 1 };
    const owner = mount();
    await act(async () => { latest.move("c", "a"); });
    expect(latest.ordered).toEqual(["c", "a", "b"]);
    owner.unmount();

    // Manager signs in on the same desktop — must get the default order.
    auth.user = { id: 2 };
    const manager = mount();
    expect(latest.ordered).toEqual(["a", "b", "c"]);

    // …and arranging his own board leaves the owner's untouched.
    await act(async () => { latest.move("b", "a"); });
    expect(latest.ordered).toEqual(["b", "a", "c"]);
    manager.unmount();

    auth.user = { id: 1 };
    mount();
    expect(latest.ordered).toEqual(["c", "a", "b"]);
  });

  test("a live account switch never persists the previous order under the new key", async () => {
    auth.user = { id: 1 };
    const view = mount();
    await act(async () => { latest.move("c", "a"); });

    // Same mounted tree, account swapped underneath (what the auth context
    // does on sign-in): the stale order must not be written for user 2.
    auth.user = { id: 2 };
    await act(async () => { view.rerender(<Probe />); });

    expect(latest.ordered).toEqual(["a", "b", "c"]);
    expect(localStorage.getItem("u2:hub:tiles:1")).toBe(JSON.stringify([]));
    expect(localStorage.getItem("u1:hub:tiles:1")).toBe(JSON.stringify(["c", "a", "b"]));
  });

  test("storage keys are namespaced by account", async () => {
    auth.user = { id: 7 };
    mount();
    await act(async () => { latest.move("b", "a"); });

    expect(localStorage.getItem("u7:hub:tiles:1")).toBe(JSON.stringify(["b", "a", "c"]));
    expect(localStorage.getItem("hub:tiles:1")).toBeNull();
  });
});
