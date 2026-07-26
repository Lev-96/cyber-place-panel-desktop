// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AuthRouteReset from "./AuthRouteReset";

const auth = vi.hoisted(() => ({ user: null as { id: number } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

let path = "";
const LocationProbe = () => {
  path = useLocation().pathname;
  return null;
};

const Tree = () => (
  <>
    <AuthRouteReset />
    <LocationProbe />
    <Routes>
      <Route path="*" element={null} />
    </Routes>
  </>
);

/**
 * The router instance survives a re-render (same element type), exactly like
 * the real `HashRouter` survives the auth state flipping — which is why the
 * location outlives the account and needs resetting.
 */
const mountAt = (entry: string) => {
  // A fresh element every time: an identical element reference makes React
  // bail out of re-rendering the subtree, so the hook would never observe
  // the account change.
  const tree = () => (
    <MemoryRouter initialEntries={[entry]}>
      <Tree />
    </MemoryRouter>
  );
  const view = render(tree());
  return { ...view, resync: () => view.rerender(tree()) };
};

afterEach(() => cleanup());

describe("AuthRouteReset", () => {
  beforeEach(() => {
    auth.user = null;
    path = "";
  });

  test("keeps the current route while the account does not change", async () => {
    auth.user = { id: 1 };
    const view = mountAt("/branches/5/places");
    expect(path).toBe("/branches/5/places");

    // A `/user/me` refresh (same account, new payload) must not move the
    // operator off the screen they are working on.
    await act(async () => { view.resync(); });
    expect(path).toBe("/branches/5/places");
  });

  test("signing out drops the branch route the account had open", async () => {
    auth.user = { id: 1 };
    const view = mountAt("/branches/5/places");

    auth.user = null;
    await act(async () => { view.resync(); });
    expect(path).toBe("/");
  });

  test("signing back in lands on the dashboard, not the last screen", async () => {
    const view = mountAt("/branches/5/sessions");
    expect(path).toBe("/branches/5/sessions");

    auth.user = { id: 1 };
    await act(async () => { view.resync(); });
    expect(path).toBe("/");
  });

  test("switching to a different account never keeps the previous one's branch", async () => {
    auth.user = { id: 1 };
    const view = mountAt("/branches/5/places");

    auth.user = { id: 2 };
    await act(async () => { view.resync(); });
    expect(path).toBe("/");
  });

  test("a deep link the app was opened with is not stolen", async () => {
    auth.user = null;
    const view = mountAt("/reset-password");
    await act(async () => { view.resync(); });
    expect(path).toBe("/reset-password");
  });
});
