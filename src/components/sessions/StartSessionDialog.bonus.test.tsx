// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import StartSessionDialog from "./StartSessionDialog";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { PSN_FEATURE } from "@/api/psn";

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

const repo = vi.hoisted(() => ({ start: vi.fn(), startQuote: vi.fn(), startOptions: vi.fn(), startQuoteByAmount: vi.fn() }));
const UNTIL_ENDS_AT = new Date(new Date().setHours(24, 40, 0, 0)).toISOString();
const UNTIL_PASSED = "This time has already passed or is more than 10 hours away. Choose another end time.";
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
const bonus = vi.hoisted(() => ({ enabled: true, bind: vi.fn(), warn: vi.fn() }));
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: {
    settings: () => Promise.resolve({ enabled: bonus.enabled, percent: "5.00", welcome: "0.00" }),
    list: () => Promise.resolve([{ id: 42, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "120.00", opened_at: null }]),
    bind: (...a: unknown[]) => bonus.bind(...a),
  },
}));
vi.mock("@/ui/notify", async (orig) => {
  const real = await orig<typeof import("@/ui/notify")>();
  return { ...real, notify: { ...real.notify, warning: (...a: unknown[]) => bonus.warn(...a) } };
});

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPackages: vi.fn().mockResolvedValue([
      { id: 1, branch_id: 7, name_en: "One hour", name_ru: "Час", name_am: "Ժամ", duration_minutes: 60, price: 1500 },
    ]),
    start: (...a: unknown[]) => repo.start(...a),
    startQuote: (...a: unknown[]) => repo.startQuote(...a),
    startOptions: (...a: unknown[]) => repo.startOptions(...a),
    startQuoteByAmount: (...a: unknown[]) => repo.startQuoteByAmount(...a),
  },
}));
// «+ Товар» in Start (2026-11-20): the basket itself is the till's (tested
// there); here a stub hands back two Colas at 500.
vi.mock("./StartProductsDialog", async (importOriginal) => {
  const real = await importOriginal<typeof import("./StartProductsDialog")>();
  return {
    ...real,
    default: ({ onConfirm, onClose }: { onConfirm: (l: unknown[]) => void; onClose: () => void }) => (
      <button type="button" data-testid="stub-pick-cola" onClick={() => { onConfirm([{ product_id: 21, qty: 2, name: "Cola", price: 500 }]); onClose(); }}>pick</button>
    ),
  };
});
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
// The dialog reads the club's billing policy to decide whether to ask which
// joystick strategy this seat runs on. Without this stub that read left the
// process as a real request to the backend, which answered 401 and surfaced as
// an unhandled rejection attributed to whichever test was running.
const club = vi.hoisted(() => ({ mode: "fixed_price" as string }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: {
    get: () => Promise.resolve({
      branch_id: 7,
      money_rounding_step: 0,
      money_rounding_mode: "up",
      joystick_price: 500,
      joystick_included: 2,
      joystick_charged_slots: "3,4",
      joystick_pricing_mode: "fixed",
      joystick_price_4: null,
      joystick_max_slot: 4,
      joystick_strategy_mode: club.mode,
    }),
  },
}));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: vi.fn().mockResolvedValue({ id: 7, price_for_branch: { "ps5-standard": 1500 } }) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  // «На сумму»'s rate line keeps its placeholders, so the server's figures are visible.
  useLang: () => ({ t: (k: string) => (k === "session.byAmount.rate" || k === "session.byAmount.food" ? `${k} {0} {1}` : k), money: (n: number) => String(n), lang: "en", currency: "AMD" }),
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

// Opened as a cashier sees it: the Modal's opening focus pass (once at once,
// once on the next frame) is over before the first key. Without the frame the
// pass could land mid-test, in whichever field was first by then — the "until"
// box once a test had chosen it — and a field with the focus rightly holds its
// "invalid" line back, so an assertion on that line passed or failed with the
// worker's speed (2026-11-15).
const onStarted = vi.fn();
const mount = async (pc: IPcApi) => {
  await act(async () => {
    render(<ConfirmProvider><StartSessionDialog branchId={7} pc={pc} onClose={() => {}} onStarted={onStarted} /></ConfirmProvider>);
  });
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
};

beforeEach(() => {
  auth.role = "company_owner";
  repo.start.mockReset();
  // A seat with nothing booked ahead: no choice, no limit (2026-11-07).
  repo.startOptions.mockReset();
  repo.startOptions.mockResolvedValue({ free_until: null, max_minutes: null, unlimited_allowed: true, next_booking: null, claimable_bookings: [] });
  repo.start.mockResolvedValue({ id: 1 });
  // The server's figure for a planned start: the seat's 1 500/h, or the rate
  // typed for this start.
  repo.startQuote.mockReset();
  repo.startQuote.mockImplementation((_pc: number, length: { minutes: number } | { until: string }, rate?: number, total?: number) => {
    // "Until" is resolved by the server on its clock: here "00:40" is 50
    // minutes away, tomorrow, and "14:00" has passed.
    if ("until" in length && length.until === "14:00") return Promise.reject(new Error(UNTIL_PASSED));
    const m = "until" in length ? 50 : length.minutes;
    const end = "until" in length ? { ends_at: UNTIL_ENDS_AT, until: length.until } : {};
    return Promise.resolve(total !== undefined
      ? { minutes: m, hourly_rate: Math.round((total * 60 / m) * 100) / 100, amount: total, standard_amount: (1500 * m) / 60, ...end }
      : { minutes: m, hourly_rate: rate ?? 1500, amount: ((rate ?? 1500) * m) / 60, standard_amount: (1500 * m) / 60, ...end });
  });
});
afterEach(cleanup);


beforeEach(() => { bonus.enabled = true; bonus.bind.mockReset(); bonus.bind.mockResolvedValue({}); bonus.warn.mockReset(); onStarted.mockReset(); });

const chooseArman = async () => {
  await act(async () => { fireEvent.click(screen.getByTestId("bonus-card-switch")); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { fireEvent.click(screen.getByTestId("bonus-pick-42")); });
};
const start = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.start" })); }); };

describe("«Бонусная карта» in Start (2026-11-25)", () => {
  test("the card is bound to the seat AFTER it started, and Start sends exactly what it sent before", async () => {
    await mount(device());
    await start();
    const without = repo.start.mock.calls[0][0];
    cleanup(); repo.start.mockClear();

    await mount(device());
    await chooseArman();
    expect(screen.getByTestId("bonus-card-chosen").textContent).toContain("Arman");
    await start();
    expect(repo.start.mock.calls[0][0]).toEqual(without);
    expect(bonus.bind).toHaveBeenCalledWith(1, 42);
    expect(onStarted).toHaveBeenCalled();
  });

  test("a bind that fails never undoes the start: it is said, and the seat runs", async () => {
    bonus.bind.mockRejectedValue(new Error("422"));
    await mount(device());
    await chooseArman();
    await start();
    expect(repo.start).toHaveBeenCalled();
    expect(bonus.warn).toHaveBeenCalledWith("bonus.start.bindFailed");
    expect(onStarted).toHaveBeenCalled();
  });

  test("no card chosen: nothing is bound", async () => {
    await mount(device());
    await start();
    expect(bonus.bind).not.toHaveBeenCalled();
  });

  test("paid ahead with bonuses (2026-11-25): the card goes WITH the start, never bound after", async () => {
    await mount(device({ kind: PC_KIND.Pc }));
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    await chooseArman();
    await act(async () => { fireEvent.click(screen.getByTestId("prepaid-switch")); });
    await act(async () => { fireEvent.click(screen.getByTestId("pay-split")); });
    const bonusBox = screen.getByTestId("pay-bonus-row").querySelector("input") as HTMLInputElement;
    await act(async () => { fireEvent.change(bonusBox, { target: { value: "120" } }); });
    const cashBox = [...document.querySelectorAll(".pay-editor__part input")][0] as HTMLInputElement;
    await act(async () => { fireEvent.change(cashBox, { target: { value: "1380" } }); });
    await start();
    expect(repo.start.mock.calls[0][0]).toMatchObject({
      prepaid: true, bonus_account_id: 42,
      payments: expect.arrayContaining([{ method: "cash", amount: 1380 }, { method: "bonus", amount: 120 }]),
    });
    expect(bonus.bind).not.toHaveBeenCalled();
  });

  test("no bonuses in the prepayment: Start sends no card, and binds it after as before", async () => {
    await mount(device({ kind: PC_KIND.Pc }));
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    await chooseArman();
    await act(async () => { fireEvent.click(screen.getByTestId("prepaid-switch")); });
    await start();
    expect(repo.start.mock.calls[0][0]).not.toHaveProperty("bonus_account_id");
    expect(bonus.bind).toHaveBeenCalledWith(1, 42);
  });

  test("no card chosen: the prepayment offers no bonuses", async () => {
    await mount(device({ kind: PC_KIND.Pc }));
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    await act(async () => { fireEvent.click(screen.getByTestId("prepaid-switch")); });
    expect(screen.queryByTestId("pay-bonus")).toBeNull();
    expect(screen.queryByTestId("pay-bonus-row")).toBeNull();
  });

  test("bonuses switched off at the branch: the switch is not drawn", async () => {
    bonus.enabled = false;
    await mount(device());
    expect(screen.queryByTestId("start-bonus-card")).toBeNull();
  });
});
