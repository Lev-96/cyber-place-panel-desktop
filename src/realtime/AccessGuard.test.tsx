// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sessionExpiry } from "@/auth/sessionExpiry";
import AccessGuard, { branchIdFromPath } from "./AccessGuard";

/**
 * The guard is the panel's half of "a block signs you out of the session you
 * already have open". Four behaviours carry it, and each one is a way a real
 * shift goes wrong if it is missing:
 *
 *  - locked out ⇒ sign out, once, with the server's sentence;
 *  - still allowed but standing in the branch that closed ⇒ leave that branch,
 *    keep the session (the owner with other venues);
 *  - standing anywhere else ⇒ nothing moves under the operator's hands;
 *  - unblock ⇒ nobody is thrown out of anything.
 */

const auth = vi.hoisted(() => ({
  user: { id: 7 } as { id: number } | null,
  logout: vi.fn(async () => {}),
  refreshUser: vi.fn(async () => {}),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

const toasts = vi.hoisted(() => ({ messages: [] as Array<{ kind: string; text: string }> }));
vi.mock("@/ui/notify", () => ({
  notify: {
    message: (kind: string, text: string) => toasts.messages.push({ kind, text }),
  },
}));

/**
 * A stand-in for the Echo channel that records what the component subscribed
 * to and hands the test a way to push an event at it — the same shape
 * `echo.private(...)` returns.
 */
const echo = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  return {
    listeners,
    channels: [] as string[],
    client: {
      private: (name: string) => {
        echo.channels.push(name);
        return {
          listen: (event: string, cb: (payload: unknown) => void) => {
            listeners.set(event, cb);
          },
          stopListening: (event: string) => {
            listeners.delete(event);
          },
        };
      },
    },
  };
});
vi.mock("@/realtime/echo", () => ({ getEcho: () => echo.client }));

let path = "";
const LocationProbe = () => {
  path = useLocation().pathname;
  return null;
};

const mountAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AccessGuard />
      <LocationProbe />
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const emit = async (payload: Record<string, unknown>) => {
  await act(async () => {
    echo.listeners.get(".access.changed")?.({
      action: "block",
      scope: "branch",
      company_id: 1,
      branch_ids: [] as number[],
      locked_out: false,
      message: null,
      at: "2026-08-15T10:00:00+04:00",
      ...payload,
    });
  });
};

afterEach(() => cleanup());

describe("AccessGuard", () => {
  beforeEach(() => {
    auth.user = { id: 7 };
    auth.logout.mockClear();
    auth.refreshUser.mockClear();
    toasts.messages = [];
    echo.listeners.clear();
    echo.channels = [];
    path = "";
  });

  test("listens on the signed-in account's own private channel", () => {
    mountAt("/");
    expect(echo.channels).toEqual(["user.7.access"]);
  });

  test("a locked-out account is signed out, showing what the server said", async () => {
    mountAt("/branches/5/pos");

    await emit({
      scope: "company",
      locked_out: true,
      message: "Your company has been blocked.",
      branch_ids: [5, 6],
    });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(toasts.messages).toEqual([
      { kind: "error", text: "Your company has been blocked." },
    ]);
  });

  test("a coded eviction is said in the panel's own language, not the server's", async () => {
    mountAt("/branches/5/pos");

    await emit({
      scope: "company",
      locked_out: true,
      // The server's sentence is in whatever locale the ADMIN's block request
      // negotiated — it must not decide what this operator reads.
      message: "Your company has been blocked. Please contact the administrator.",
      code: "company_blocked",
      reason: "company",
      branch_ids: [5, 6],
    });

    expect(toasts.messages).toEqual([
      { kind: "error", text: "blocking.reason.company_blocked" },
    ]);
  });

  test("an unknown code falls back to the sentence the server sent", async () => {
    mountAt("/");

    await emit({
      locked_out: true,
      code: "something_this_build_has_never_heard_of",
      message: "Server wording.",
    });

    expect(toasts.messages).toEqual([{ kind: "error", text: "Server wording." }]);
  });

  test("falls back to its own wording when the server sent no sentence", async () => {
    mountAt("/");
    await emit({ locked_out: true, message: null });

    expect(toasts.messages[0].text).toBe("blocking.evicted.lockedOut");
  });

  test("an owner standing in the blocked branch leaves its sections but keeps the session — and the branch", async () => {
    mountAt("/branches/5/sessions");

    await emit({ branch_ids: [5] });

    // To the branch's OWN page, not the dashboard: the branch stays readable
    // (state, history, why it closed) and only its working screens shut.
    expect(path).toBe("/branches/5");
    expect(auth.logout).not.toHaveBeenCalled();
    expect(toasts.messages).toEqual([
      { kind: "error", text: "blocking.evicted.branch" },
    ]);
  });

  test("already on the branch page, nothing moves", async () => {
    mountAt("/branches/5");

    await emit({ branch_ids: [5] });

    expect(path).toBe("/branches/5");
    expect(auth.logout).not.toHaveBeenCalled();
  });

  test("a company block relocates from any of the branches it names", async () => {
    mountAt("/branches/9/live");

    await emit({ scope: "company", branch_ids: [8, 9, 10] });

    expect(path).toBe("/branches/9");
  });

  test("a block elsewhere does not move the operator off the screen they are on", async () => {
    mountAt("/branches/5/pos");

    await emit({ branch_ids: [6] });

    expect(path).toBe("/branches/5/pos");
    expect(auth.logout).not.toHaveBeenCalled();
    expect(toasts.messages).toEqual([]);
    // The account payload is still refreshed — the block changed what this
    // person can reach even when it did not change where they are standing.
    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
  });

  test("unblocking throws nobody out of anything", async () => {
    mountAt("/branches/5/pos");

    await emit({ action: "unblock", branch_ids: [5] });

    expect(path).toBe("/branches/5/pos");
    expect(auth.logout).not.toHaveBeenCalled();
    expect(toasts.messages).toEqual([]);
    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
  });

  test("a signed-out panel subscribes to nothing", () => {
    auth.user = null;
    mountAt("/");
    expect(echo.channels).toEqual([]);
  });

  test("a refused token signs out even when no event arrives", async () => {
    mountAt("/branches/5/pos");

    // Reverb down / unconfigured: the block never reaches the channel, but the
    // tokens it revoked make the next request 401.
    await act(async () => { sessionExpiry.raise(); });

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  test("a 401 arriving at a signed-out panel signs nobody out again", async () => {
    auth.user = null;
    mountAt("/");

    await act(async () => { sessionExpiry.raise(); });

    expect(auth.logout).not.toHaveBeenCalled();
  });
});

describe("branchIdFromPath", () => {
  test("reads the branch a screen belongs to", () => {
    expect(branchIdFromPath("/branches/12")).toBe(12);
    expect(branchIdFromPath("/branches/12/pos")).toBe(12);
  });

  test("is not fooled by paths that merely start the same way", () => {
    expect(branchIdFromPath("/")).toBeNull();
    expect(branchIdFromPath("/branches")).toBeNull();
    expect(branchIdFromPath("/branches/new")).toBeNull();
    expect(branchIdFromPath("/companies/12/branches")).toBeNull();
  });
});
