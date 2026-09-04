// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
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
 */

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPackages: vi.fn().mockResolvedValue([
      { id: 1, branch_id: 7, name_en: "One hour", name_ru: "Час", name_am: "Ժամ", duration_minutes: 60, price: 1500 },
    ]),
    start: vi.fn(),
  },
}));
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
