// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import StartSessionDialog from "./StartSessionDialog";

/**
 * Which tariffs a seat can be sold.
 *
 * The rule pinned here is one line of markup with a long tail: the package tab
 * was disabled for PlayStation places, on the reasonable grounds that count-up
 * is the sensible default for a console. It is — and it still is the default.
 *
 * What disabling the TAB did was make two other features unreachable on every
 * console in the building. A count-up session has no end, so "+30 minutes" has
 * nothing to extend and "switch to unlimited" is already true; an operator
 * opening Options on a PS session found both greyed out with no route to them.
 * The backend has always accepted a package on any device.
 *
 * It also pins the Free-session control, which is the same money decision the
 * options dialog carries and therefore the same role: the checkbox is drawn for
 * an owner, is absent for a manager, and the flag is sent only when it was
 * actually ticked — so a backend from before this release sees the request it
 * has always seen.
 */

const repo = vi.hoisted(() => ({ start: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPackages: vi.fn().mockResolvedValue([
      { id: 1, branch_id: 7, name_en: "One hour", name_ru: "Час", name_am: "Ժամ", duration_minutes: 60, price: 1500 },
    ]),
    start: (...a: unknown[]) => repo.start(...a),
  },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: vi.fn().mockResolvedValue({ id: 7, price_for_branch: { "ps5-standard": 1500 } }) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const device = (over: Partial<IPcApi> = {}): IPcApi => ({
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "PS5 VIP",
  kind: PC_KIND.Ps,
  status: PC_STATUS.Online,
  place: { id: 10, number: 1, name: "PS5 VIP", type: "standard", platform: "ps5" },
  ...over,
});

const mount = async (pc: IPcApi) => {
  await act(async () => {
    render(<StartSessionDialog branchId={7} pc={pc} onClose={() => {}} onStarted={() => {}} />);
  });
};

beforeEach(() => {
  auth.role = "company_owner";
  repo.start.mockReset();
  repo.start.mockResolvedValue({ id: 1 });
});
afterEach(cleanup);

describe("starting a session on a console", () => {
  test("offers the package tab, so extra time and unlimited are reachable later", async () => {
    await mount(device());

    const fixed = screen.getByRole("button", { name: /session.fixedTariff/ }) as HTMLButtonElement;
    expect(fixed.disabled).toBe(false);
  });

  test("still defaults a console to count-up, which is what a venue expects", async () => {
    await mount(device());

    // The package list is only rendered in fixed mode; its absence is how the
    // default reads from the outside.
    expect(screen.queryByText("One hour")).toBeNull();
  });

  test("still defaults a computer to a package", async () => {
    await mount(device({
      kind: PC_KIND.Pc,
      place: { id: 10, number: 1, name: "PC-1", type: "standard", platform: "pc" },
    }));

    expect(screen.getByText("One hour")).toBeTruthy();
  });
});

describe("starting a session free", () => {
  /** A computer, so the package tab is the default and the start needs no rate. */
  const computer = () => device({
    kind: PC_KIND.Pc,
    place: { id: 10, number: 1, name: "PC-1", type: "standard", platform: "pc" },
  });

  test("is offered to an owner", async () => {
    await mount(computer());

    expect(screen.getByText("session.freeBill")).toBeTruthy();
  });

  test("is not offered to a manager", async () => {
    auth.role = "manager";
    await mount(computer());

    expect(screen.queryByText("session.freeBill")).toBeNull();
  });

  test("sends the flag only when it was actually ticked", async () => {
    await mount(computer());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "action.start" }));
    });

    // Absent, not `false`: a backend from before this release must see exactly
    // the body it has always seen.
    expect(repo.start).toHaveBeenCalledTimes(1);
    expect(repo.start.mock.calls[0][0]).not.toHaveProperty("is_free");
  });

  test("sends it when it was", async () => {
    await mount(computer());

    await act(async () => {
      fireEvent.click(screen.getByText("session.freeBill"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "action.start" }));
    });

    expect(repo.start).toHaveBeenCalledTimes(1);
    expect(repo.start.mock.calls[0][0]).toMatchObject({ is_free: true });
  });

  /**
   * Free is not "a price of zero". The two behave differently the moment a
   * drink is added, so ticking one must not touch the other's control.
   */
  test("does not disturb the price override", async () => {
    await mount(device());

    await act(async () => {
      fireEvent.click(screen.getByText("session.freeBill"));
    });

    const override = screen.getByText("session.editPrice")
      .closest("label")!
      .querySelector("input") as HTMLInputElement;
    expect(override.checked).toBe(false);
  });
});
