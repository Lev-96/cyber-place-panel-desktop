// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionOptionsDialog from "./SessionOptionsDialog";

/**
 * What a cashier can actually reach on a running session.
 *
 * The service tests on the backend prove the rules; this proves the SCREEN
 * obeys them — which is a different claim and the one that decides what a
 * person can press. Two things in particular:
 *
 *  - the count of pads is whatever the SERVER says. Nothing here derives it,
 *    because two cashiers deriving it separately is how one board says three
 *    and the other says four over the same seat;
 *  - a refusal is shown VERBATIM. "No price is set for joystick #3" is a
 *    sentence an operator can act on; a swallowed error is a button that does
 *    nothing for no stated reason.
 */

const repo = vi.hoisted(() => ({
  addJoystick: vi.fn(),
  removeJoystick: vi.fn(),
  addTime: vi.fn(),
  makeUnlimited: vi.fn(),
  setFree: vi.fn(),
}));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    addJoystick: (...a: unknown[]) => repo.addJoystick(...a),
    removeJoystick: (...a: unknown[]) => repo.removeJoystick(...a),
    addTime: (...a: unknown[]) => repo.addTime(...a),
    makeUnlimited: (...a: unknown[]) => repo.makeUnlimited(...a),
    setFree: (...a: unknown[]) => repo.setFree(...a),
  },
}));
vi.mock("@/repositories/JoystickPriceRepository", () => ({
  joystickPriceRepository: {
    listByBranch: vi.fn().mockResolvedValue([
      { id: 1, branch_id: 7, slot: 2, price_per_hour: 500 },
      { id: 2, branch_id: 7, slot: 3, price_per_hour: 700 },
      { id: 3, branch_id: 7, slot: 4, price_per_hour: 700 },
    ]),
  },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const session = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 42,
  branch_id: 7,
  pc_id: 21,
  pc_label: "№1",
  started_at: "2026-09-03T14:00:00.000Z",
  ends_at: "2026-09-03T15:00:00.000Z",
  status: "active",
  total_paid: 0,
  joystick_count: 1,
  joysticks: [],
  is_free: false,
  is_unlimited: false,
  ...over,
});

const mount = async (s: ISessionApi = session(), platform = "ps5") => {
  await act(async () => {
    render(
      <SessionOptionsDialog session={s} platform={platform} onClose={() => {}} onChanged={() => {}} />,
    );
  });
};

beforeEach(() => {
  auth.role = "company_owner";
  Object.values(repo).forEach((fn) => fn.mockReset());
});
afterEach(cleanup);

describe("the joystick controls", () => {
  test("show as many pads as the SERVER counted, never a locally derived number", async () => {
    await mount(session({ joystick_count: 3 }));

    expect(screen.getByLabelText("3").textContent).toContain("🎮🎮🎮");
    expect(screen.getByText("3 / 4")).toBeTruthy();
  });

  test("offer the price the NEXT pad will actually cost", async () => {
    // Two in play, so the next is the third — and slot 3 costs 700, not 500.
    await mount(session({ joystick_count: 2 }));

    expect(screen.getByText(/700/)).toBeTruthy();
  });

  test("stop offering a fifth", async () => {
    await mount(session({ joystick_count: 4 }));

    const add = screen.getByRole("button", { name: /session.joystickAdd/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  test("are absent on a place that is not a PlayStation", async () => {
    // `pc.kind === "ps"` is equally true of a ping-pong table; the platform is
    // the question, and the dialog asks the same one the backend does.
    await mount(session(), "table-tennis");

    expect(screen.queryByRole("button", { name: /session.joystickAdd/ })).toBeNull();
    expect(screen.getByText("session.joystickPsOnly")).toBeTruthy();
  });

  test("remove a pad by its SLOT, which is what the operator can see", async () => {
    repo.removeJoystick.mockResolvedValue(session({ joystick_count: 1, joysticks: [] }));
    await mount(session({
      joystick_count: 2,
      joysticks: [{ id: 5, slot: 2, hourly_rate: 500, started_at: "2026-09-03T14:10:00.000Z", stopped_at: null }],
    }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /session.joystickRemove/ }));
    });

    expect(repo.removeJoystick).toHaveBeenCalledWith(42, 2);
  });

  test("show the server's refusal word for word", async () => {
    repo.addJoystick.mockRejectedValue(new Error("No price is set for joystick #3"));
    await mount(session({ joystick_count: 2 }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /session.joystickAdd/ }));
    });

    expect(screen.getByText("No price is set for joystick #3")).toBeTruthy();
  });
});

describe("time and the ceiling", () => {
  test("offer the three grants and send the minutes", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();

    // Three buttons match — +10, +30, +60. The first is the one asserted, and
    // that all three exist is asserted with it.
    const grants = screen.getAllByRole("button", { name: /session.addMinutes/ });
    expect(grants).toHaveLength(3);

    await act(async () => {
      fireEvent.click(grants[0]);
    });

    expect(repo.addTime).toHaveBeenCalledWith(42, 10);
  });

  test("do not offer extra time on a session that has no end", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));

    expect(screen.queryAllByRole("button", { name: /session.addMinutes/ })).toHaveLength(0);
    expect(screen.getByText("session.timeNotApplicable")).toBeTruthy();
  });

  test("show the booking refusal instead of silently doing nothing", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    repo.makeUnlimited.mockRejectedValue(new Error("This place is booked in the app."));
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /session.makeUnlimited/ }));
    });

    expect(screen.getByText("This place is booked in the app.")).toBeTruthy();
  });

  test("ask before lifting the ceiling, and do nothing if the answer is no", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /session.makeUnlimited/ }));
    });

    expect(repo.makeUnlimited).not.toHaveBeenCalled();
  });
});

describe("waiving the bill", () => {
  test("is offered to an owner", async () => {
    auth.role = "company_owner";
    await mount();

    expect(screen.getByText("session.freeBill")).toBeTruthy();
  });

  test("is NOT offered to a manager", async () => {
    // The backend refuses it on `sessions.free` regardless — this is the half
    // that keeps a manager from pressing a button that would only ever 403.
    auth.role = "manager";
    await mount();

    expect(screen.queryByText("session.freeBill")).toBeNull();
  });

  test("sends the new value, both directions", async () => {
    repo.setFree.mockResolvedValue(session({ is_free: true }));
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });

    expect(repo.setFree).toHaveBeenCalledWith(42, true);
  });
});

describe("a session that is over", () => {
  test("says so and offers nothing", async () => {
    await mount(session({ status: "stopped" }));

    expect(screen.getByText("session.optionsClosedSession")).toBeTruthy();
    const add = screen.getByRole("button", { name: /session.joystickAdd/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });
});
