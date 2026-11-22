// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionOptionsDialog from "./SessionOptionsDialog";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

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
  timeQuote: vi.fn(),
  addTimeByAmount: vi.fn(),
  timeQuoteByAmount: vi.fn(),
  limit: vi.fn(),
  limitQuote: vi.fn(),
  setUnpaid: vi.fn(),
  makeUnlimited: vi.fn(),
  setFree: vi.fn(),
  extensionOptions: vi.fn(),
  transferExtension: vi.fn(),
  setReminder: vi.fn(),
  clearReminder: vi.fn(),
}));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
// The app-wide toaster, captured so a test can read what a grant announced.
const toast = vi.hoisted(() => ({ message: vi.fn(), warning: vi.fn() }));
vi.mock("@/ui/notify", () => ({
  notify: {
    message: (...a: unknown[]) => toast.message(...a),
    warning: (...a: unknown[]) => toast.warning(...a),
  },
}));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    addJoystick: (...a: unknown[]) => repo.addJoystick(...a),
    removeJoystick: (...a: unknown[]) => repo.removeJoystick(...a),
    addTime: (...a: unknown[]) => repo.addTime(...a),
    timeQuote: (...a: unknown[]) => repo.timeQuote(...a),
    addTimeByAmount: (...a: unknown[]) => repo.addTimeByAmount(...a),
    limit: (...a: unknown[]) => repo.limit(...a),
    limitQuote: (...a: unknown[]) => repo.limitQuote(...a),
    setUnpaid: (...a: unknown[]) => repo.setUnpaid(...a),
    timeQuoteByAmount: (...a: unknown[]) => repo.timeQuoteByAmount(...a),
    makeUnlimited: (...a: unknown[]) => repo.makeUnlimited(...a),
    setFree: (...a: unknown[]) => repo.setFree(...a),
    extensionOptions: (...a: unknown[]) => repo.extensionOptions(...a),
    transferExtension: (...a: unknown[]) => repo.transferExtension(...a),
    setReminder: (...a: unknown[]) => repo.setReminder(...a),
    clearReminder: (...a: unknown[]) => repo.clearReminder(...a),
  },
}));
const prices = vi.hoisted(() => ({
  get: vi.fn(),
  // ONE fee for every pad. It was three prices, one per slot; no venue ever
  // set them differently.
  fee: 500 as number | null,
}));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: {
    get: (...a: unknown[]) => prices.get(...a),
  },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    // `t` echoes the key, which keeps every other assertion here about
    // structure rather than copy. The one exception carries a `{0}` so the
    // component's own interpolation stays observable — otherwise a test for
    // "the platform is named" would pass on a template that never
    // interpolated anything.
    // The seat-move messages join the exception: both name a SEAT, and a test
    // that could not see the number would pass on a message that named the
    // wrong one.
    t: (k: string) =>
      k === "session.joystickThisPlatform" ||
      k === "session.movedToast" ||
      k === "session.moveTakenToast"
        ? `${k} {0}`
        // The keep-the-rate toasts (2026-11-15) name the SERVER's figure.
        : k === "session.unlimitedDoneKept" || k === "session.limitDoneRate" || k === "session.limitDoneStart" ? `${k} {0} {1}`
        // «Задать время» (2026-11-15): the server's end, length and figures.
        : k === "session.limitUntil" || k === "session.limitTimeTotal"
          || k === "session.limitFromNow" || k === "session.limitPlayed" ? `${k} {0}`
        : k === "session.limitDoneNow" ? `${k} {0} {1} {2}`
        : k,
    money: (n: number) => String(n),
    lang: "en",
    currency: "AMD",
  }),
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
  // What the server resolved this seat's hourly rate to be. A real fixed
  // session always has one — its `hourly_rate` column is null, and this is the
  // field that answers instead — so the default fixture carries it and the
  // tests that care about its ABSENCE say so explicitly.
  tariff_hourly_rate: 1500,
  ...over,
});

/**
 * Answer the in-app ConfirmDialog. `action.confirm` / `action.cancel` are the
 * keys its buttons fall back to, and `t` here echoes keys.
 */
const answerConfirm = async (yes: boolean) => {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: yes ? "action.confirm" : "action.cancel" }),
    );
  });
};

/** Past the quote's debounce, and let its answer land. */
const settle = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
};

/** A wall-clock time the way the dialog prints one: 24-hour, the machine's zone. */
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The server's two answers for `m` minutes on seat #258's shape: ten seconds
 * played at 1000/h. In all: until 15:15:37 for 1000. From now: until 15:15:47,
 * 1002.78 for the seat's time in all.
 */
const limitQuoteOf = (m: number, over: Record<string, unknown> = {}) => ({
  minutes: m, hourly_rate: 1000, played_seconds: 10,
  start: { available: true, from: "start", minutes: m, played_seconds: 10, hourly_rate: 1000,
    ends_at: new Date(Date.parse("2026-11-15T14:15:37Z") + m * 60_000).toISOString(),
    time_total: Math.round(m * 1000 / 60 * 100) / 100, charge: Math.round((m * 1000 / 60 - 2.78) * 100) / 100 },
  now: { available: true, from: "now", minutes: m, played_seconds: 10, hourly_rate: 1000,
    ends_at: new Date(Date.parse("2026-11-15T14:15:47Z") + m * 60_000).toISOString(),
    time_total: Math.round((m * 1000 / 60 + 2.78) * 100) / 100, charge: Math.round(m * 1000 / 60 * 100) / 100 },
  ...over,
});

// The start dialog's time field (2026-11-07): an hours box and a minutes box.
const hoursBox = () => screen.getByTestId("grant-duration-hours") as HTMLInputElement;
const minutesBox = () => screen.getByTestId("grant-duration-minutes") as HTMLInputElement;

/** Hours, typed into the field's hours box. */
const typeAmount = async (value: string) => {
  await act(async () => { fireEvent.change(hoursBox(), { target: { value } }); });
};

/** Minutes, typed into the field's minutes box. */
const typeMinutes = async (value: string) => {
  await act(async () => { fireEvent.change(minutesBox(), { target: { value } }); });
};

const confirmGrant = () =>
  screen.getByRole("button", { name: /session.timeAddConfirmPriced/ }) as HTMLButtonElement;

/** Choose N minutes, wait for the server's price, confirm. */
const requestGrant = async (minutes = 10) => {
  await typeMinutes(String(minutes));
  await settle();
  await act(async () => { fireEvent.click(confirmGrant()); });
};

const mount = async (s: ISessionApi = session(), platform = "ps5") => {
  await act(async () => {
    render(
      <ConfirmProvider>
        <SessionOptionsDialog session={s} platform={platform} onClose={() => {}} onChanged={() => {}} />
      </ConfirmProvider>,
    );
  });
};
/** «+ Время» is one dialog (2026-11-07): «Безлимит» is a part of it on a timed seat. */
const mountUnlimited = (s: ISessionApi = session()) => mount(s, "ps5");

beforeEach(() => {
  auth.role = "company_owner";
  Object.values(repo).forEach((fn) => fn.mockReset());
  // Cleared per test: "announced nothing" is only meaningful if an earlier
  // test's toast cannot be mistaken for this one's.
  toast.message.mockReset();
  prices.fee = 500;
  // The server's price for N minutes at a 1 000/h session: what the confirm
  // names and waits for.
  repo.timeQuote.mockImplementation((_id: number, m: number, charge?: number) =>
    Promise.resolve({
      minutes: m, hourly_rate: 1000, charge: charge ?? (m * 1000) / 60, standard_charge: (m * 1000) / 60,
      price_editable: true, is_free: false,
    }));
  // By money at 1 000/h: 700 buys 42 minutes, charged as typed (a plan).
  repo.timeQuoteByAmount.mockImplementation((_id: number, a: number) =>
    Promise.resolve({
      minutes: Math.round((a * 60) / 1000), hourly_rate: 1000, charge: a, standard_charge: a,
      price_editable: true, is_free: false, amount: a,
    }));
  prices.get.mockReset();
  prices.get.mockImplementation(() => Promise.resolve({
    branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: prices.fee,
  }));
});
afterEach(cleanup);

describe("the dialog itself", () => {
  /**
   * The bug this pins shipped and was reported from the floor: the dialog
   * rendered as a transparent sheet with the sessions board legible straight
   * through it.
   *
   * `Modal` deliberately renders only the backdrop and the centring wrapper —
   * every dialog in this app supplies its own opaque surface, and `.card` is
   * that surface (`background: var(--color-surface)` in global.css). A dialog
   * that forgets it is invisible in exactly this way, and nothing else in the
   * suite notices, because every assertion about content passes on a
   * transparent dialog.
   */
  test("stands on an opaque surface", async () => {
    await mount();

    // The dialog's own root inside the modal's box (which also holds the ×).
    const surface = document.querySelector(".cp-modal-dialog > *");
    expect(surface, "the dialog rendered nothing inside the modal wrapper").toBeTruthy();
    expect(
      surface!.classList.contains("card"),
      "the dialog's root is missing `card` — it will render transparent over the board",
    ).toBe(true);
  });
});

/**
 * The two blocks this dialog no longer carries.
 *
 * Joysticks moved to the SESSION CARD and waiving the bill lives on START
 * SESSION — two places to press for one thing is two places to keep in step,
 * and the bill decision is made when the session begins, not halfway through
 * a form about minutes. Both features are unchanged where they actually live;
 * their own tests cover them there.
 *
 * These assertions exist so the duplicates cannot drift back in unnoticed.
 */
/**
 * A grant is announced only once the SERVER has said yes.
 *
 * Fired on the click instead, the toast would tell a cashier the time was
 * added while the request was still in flight — and this request is refused
 * often enough (a reservation ahead) that the lie would be a regular one.
 */
describe("announcing a grant", () => {
  test("says how many minutes and WHICH seat, after the server answered", async () => {
    repo.addTime.mockResolvedValueOnce(session());
    await mount();
    await requestGrant();

    expect(toast.message).toHaveBeenCalledWith("success", expect.stringContaining("session.timeAddedToast"));
  });

  test("says nothing when the grant was refused", async () => {
    repo.addTime.mockRejectedValueOnce(
      Object.assign(new Error("Session not active"), { body: { message: "Session not active" } }),
    );
    await mount();
    await requestGrant();

    expect(toast.message).not.toHaveBeenCalled();
  });
});

describe("what this dialog deliberately does NOT offer", () => {
  test("no joystick controls — the session card owns them", async () => {
    await mount();

    expect(screen.queryByRole("button", { name: /session.joystickAdd/ })).toBeNull();
    expect(screen.queryByText("session.joysticks")).toBeNull();
  });

  test("no waive-the-bill checkbox — Start Session owns that decision", async () => {
    auth.role = "company_owner";
    await mount();

    expect(screen.queryByText("session.freeBill")).toBeNull();
    expect(screen.queryByText("session.freeBillHint")).toBeNull();
  });
});

/**
 * Arm the unlimited switch the way the form asks for it: tick the gate.
 * Nothing about the switch is offered until it is ticked — removing a seat's
 * end cannot be undone, so it reads as a deliberate act. No price is typed
 * (2026-11-15): it carries on at the rate it bills at now.
 */
const armUnlimited = async () => {
  await act(async () => {
    fireEvent.click(screen.getByText("session.unlimitedGate"));
  });
};

const switchButton = () =>
  screen.getByRole("button", { name: "session.unlimitedApply" }) as HTMLButtonElement;

describe("time and the ceiling", () => {
  test("the start dialog's time field, no quick picks, and the minutes are what is sent (2026-11-07)", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();

    expect(screen.queryAllByRole("button", { name: /time\.(hourShort|minShort)$/ })).toHaveLength(0);
    expect(screen.queryByRole("tab", { name: "session.timeUnitHours" })).toBeNull();

    await typeAmount("1");
    await typeMinutes("30");
    await settle();
    await act(async () => { fireEvent.click(confirmGrant()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 90, undefined, undefined);
  });

  test("do not offer extra time on a session that has no end", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));

    expect(screen.queryByRole("button", { name: /session.timeAddConfirmPriced/ })).toBeNull();
    expect(screen.queryByTestId("grant-duration-hours")).toBeNull();
    // What it offers instead: a fixed time from now.
    expect(screen.getByTestId("limit-section")).toBeTruthy();
    expect(repo.timeQuote).not.toHaveBeenCalled();
  });

  test("show the booking refusal instead of silently doing nothing", async () => {
    repo.makeUnlimited.mockRejectedValue(new Error("This place is booked in the app."));
    await mountUnlimited();
    await armUnlimited();

    await act(async () => {
      fireEvent.click(switchButton());
    });
    await answerConfirm(true);

    expect(screen.getByText("This place is booked in the app.")).toBeTruthy();
  });

  test("ask before lifting the ceiling, and do nothing if the answer is no", async () => {
    await mountUnlimited();
    await armUnlimited();

    await act(async () => {
      fireEvent.click(switchButton());
    });
    await answerConfirm(false);

    expect(repo.makeUnlimited).not.toHaveBeenCalled();
  });

  /**
   * A native `window.confirm` poisons the Electron renderer's keyboard focus on
   * Linux, so this dialog must never reach for one. Asserting the absence is
   * what keeps it out: the in-app dialog and the native call look identical
   * from the outside right up until the cashier's next modal stops typing.
   */
  test("never asks through a native confirm", async () => {
    const native = vi.spyOn(window, "confirm");
    await mountUnlimited();
    await armUnlimited();

    await act(async () => {
      fireEvent.click(switchButton());
    });

    expect(native).not.toHaveBeenCalled();
    // …and something was actually asked, so this is not passing on a button
    // that quietly does nothing.
    expect(screen.getByText("session.unlimitedConfirm")).toBeTruthy();
    await answerConfirm(false);
  });
});

describe("what the card cannot say and this must", () => {
  test("names the tariff and how long the session has run", async () => {
    // Without these, "+30 min" is a button pressed on faith.
    await mount(session({
      package_name: "Один час",
      started_at: new Date(Date.now() - 80 * 60_000).toISOString(),
    }));

    expect(screen.getByText(/session.tariffField/)).toBeTruthy();
    expect(screen.getByText("Один час")).toBeTruthy();
    expect(screen.getByText(/session.elapsedField/)).toBeTruthy();
    // 80 minutes reads as "1 h 20 min", not "80".
    expect(screen.getByText(/1 .*20 /)).toBeTruthy();
  });

  test("says Unlimited as the tariff once the ceiling is lifted", async () => {
    await mount(session({ is_unlimited: true, ends_at: null, package_name: "Один час" }));

    expect(screen.getAllByText(/session.unlimited/).length).toBeGreaterThan(0);
  });
});

describe("a session that is over", () => {
  test("says so and offers nothing", async () => {
    await mount(session({ status: "stopped" }));

    expect(screen.getByText("session.optionsClosedSession")).toBeTruthy();
    expect(hoursBox().disabled).toBe(true);
    expect(confirmGrant().disabled).toBe(true);
    expect(repo.timeQuote).not.toHaveBeenCalled();
  });
});

/**
 * The grant typed by hand, and the price it is sold at (2026-10-25).
 *
 * The unit is the whole point: a cashier typing "2" means two HOURS far more
 * often than two minutes. Hours are the default, the confirm names the
 * resolved minutes AND the server's price, and nothing can be confirmed until
 * the server has priced exactly what is on screen.
 */
describe("a grant typed by hand, and its price", () => {
  test("hours are the default: 2 is 120 minutes", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();
    await typeAmount("2");
    await settle();
    await act(async () => { fireEvent.click(confirmGrant()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 120, undefined, undefined);
  });

  test("half an hour is a legitimate thing to type", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();
    await typeAmount("1.5");
    await settle();
    await act(async () => { fireEvent.click(confirmGrant()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 90, undefined, undefined);
  });

  test("minutes typed on the minutes tab are sent as typed", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();
    await requestGrant(45);

    expect(repo.addTime).toHaveBeenCalledWith(42, 45, undefined, undefined);
  });

  test.each([
    ["nothing", ""],
    ["a zero", "0"],
    ["words", "abc"],
    ["more than the server's ceiling", "601"],
  ])("refuses %s", async (_name, value) => {
    await mount();
    await typeMinutes(value);
    await settle();

    expect(confirmGrant().disabled).toBe(true);
    expect(repo.timeQuote).not.toHaveBeenCalled();
    expect(repo.addTime).not.toHaveBeenCalled();
  });

  test("says why, but only once something has been typed", async () => {
    await mount();
    expect(screen.queryByText("session.timeInvalid")).toBeNull();

    await typeAmount("0");
    await act(async () => { fireEvent.focusOut(hoursBox(), { relatedTarget: null }); });
    expect(screen.getByText("session.timeInvalid")).toBeTruthy();
  });

  test("a refused grant keeps what was typed", async () => {
    repo.addTime.mockRejectedValue(new Error("Seat is booked at 20:00"));
    await mount();
    await requestGrant(30);

    expect(screen.getByText("Seat is booked at 20:00")).toBeTruthy();
    expect(minutesBox().value).toBe("30");
  });

  test("the price shown is the server's, for exactly the length chosen", async () => {
    await mount();
    await typeAmount("3");
    await settle();

    expect(repo.timeQuote).toHaveBeenLastCalledWith(42, 180, undefined);
    expect(within(screen.getByTestId("quoted-price")).getByText("3000")).toBeTruthy();
    expect(confirmGrant().disabled).toBe(false);
  });

  test("nothing can be confirmed before the server has priced it", async () => {
    let answer: (v: unknown) => void = () => {};
    repo.timeQuote.mockImplementation(() => new Promise((r) => { answer = r; }));
    await mount();
    await typeAmount("1");
    await settle();

    expect(confirmGrant().disabled).toBe(true);
    expect(within(screen.getByTestId("quoted-price")).getByText("…")).toBeTruthy();

    await act(async () => { answer({ minutes: 60, hourly_rate: 1000, charge: 1000, is_free: false }); });
    expect(confirmGrant().disabled).toBe(false);
  });

  test("a refused price shows the reason and no figure, and cannot be confirmed", async () => {
    repo.timeQuote.mockRejectedValue(new Error("No rate is set for this seat"));
    await mount();
    await typeAmount("1");
    await settle();

    const box = screen.getByTestId("quoted-price");
    expect(within(box).getByText("No rate is set for this seat")).toBeTruthy();
    expect(within(box).getByText("-")).toBeTruthy();
    expect(confirmGrant().disabled).toBe(true);
  });

  test("a slow answer for an earlier value never sits beside a newer one", async () => {
    const answers: Array<(v: unknown) => void> = [];
    repo.timeQuote.mockImplementation((_id: number, m: number) =>
      new Promise((r) => { answers.push(() => r({ minutes: m, hourly_rate: 1000, charge: (m * 1000) / 60, is_free: false })); }));
    await mount();
    await typeAmount("1");
    await settle();
    await typeAmount("2");
    await settle();

    // The newer answer lands first, then the stale one.
    await act(async () => { answers[1](undefined); });
    await act(async () => { answers[0](undefined); });

    const box = screen.getByTestId("quoted-price");
    expect(within(box).getByText("2000")).toBeTruthy();
    expect(within(box).queryByText("1000")).toBeNull();
  });

  test("a second press while the grant is in flight grants nothing more", async () => {
    let done: (v: ISessionApi) => void = () => {};
    repo.addTime.mockImplementation(() => new Promise((r) => { done = r; }));
    await mount();
    await typeAmount("1");
    await settle();

    await act(async () => { fireEvent.click(confirmGrant()); });
    await act(async () => { fireEvent.click(confirmGrant()); });
    await act(async () => { done(session()); });

    expect(repo.addTime).toHaveBeenCalledTimes(1);
  });

  /** The price typed by hand (2026-10-25), on a seat the server says takes one. */
  describe("the price changed by hand", () => {
    const setCharge = async (value: string) => {
      const box = screen.getByTestId("grant-charge").querySelector("input")!;
      await act(async () => { fireEvent.change(box, { target: { value } }); });
    };
    const tick = async () => {
      await act(async () => { fireEvent.click(screen.getByText("session.plannedEditTotal")); });
    };

    test("prefilled with the server's figure, quoted and sent as typed", async () => {
      repo.addTime.mockResolvedValue(session());
      await mount();
      await typeAmount("2");
      await settle();
      await tick();
      expect((screen.getByTestId("grant-charge").querySelector("input") as HTMLInputElement).value).toBe("2000");

      await setCharge("1500");
      await settle();
      expect(repo.timeQuote).toHaveBeenLastCalledWith(42, 120, 1500);
      expect(within(screen.getByTestId("quoted-price")).getByText("1500")).toBeTruthy();
      expect(screen.getByText(/session\.plannedStandard: 2000/)).toBeTruthy();

      await act(async () => { fireEvent.click(confirmGrant()); });
      expect(repo.addTime).toHaveBeenCalledWith(42, 120, 1500, undefined);
    });

    test("zero is a gift and can be confirmed", async () => {
      repo.addTime.mockResolvedValue(session());
      await mount();
      await typeAmount("1");
      await settle();
      await tick();
      await setCharge("0");
      await settle();
      await act(async () => { fireEvent.click(confirmGrant()); });
      expect(repo.addTime).toHaveBeenCalledWith(42, 60, 0, undefined);
    });

    test("an empty or negative price holds the confirm", async () => {
      await mount();
      await typeAmount("1");
      await settle();
      await tick();
      for (const v of ["", "-5"]) {
        await setCharge(v);
        await settle();
        expect(confirmGrant().disabled).toBe(true);
      }
    });

    test("a quote for a different price does not unlock the confirm", async () => {
      await mount();
      await typeAmount("1");
      await settle();
      await tick();
      let answer: (v: unknown) => void = () => {};
      repo.timeQuote.mockImplementation(() => new Promise((r) => { answer = r; }));
      await setCharge("700");
      await settle();
      await act(async () => {
        answer({ minutes: 60, hourly_rate: 1000, charge: 1000, standard_charge: 1000, price_editable: true, is_free: false });
      });
      expect(confirmGrant().disabled).toBe(true);
    });

    test("not offered on a seat the server says cannot take one", async () => {
      repo.timeQuote.mockImplementation((_id: number, m: number) => Promise.resolve({
        minutes: m, hourly_rate: 1000, charge: (m * 1000) / 60, standard_charge: (m * 1000) / 60,
        price_editable: false, is_free: false,
      }));
      await mount();
      await typeAmount("1");
      await settle();
      expect(screen.queryByText("session.plannedEditTotal")).toBeNull();
    });
  });

  test("a waived session says nothing will be charged", async () => {
    repo.timeQuote.mockImplementation((_id: number, m: number) =>
      Promise.resolve({ minutes: m, hourly_rate: 1000, charge: (m * 1000) / 60, is_free: true }));
    await mount(session({ is_free: true }));
    await typeAmount("1");
    await settle();

    expect(screen.getByText("session.priceFreeNote")).toBeTruthy();
  });
});

/**
 * The price a session carries on at once its end is removed.
 *
 * Shown before the switch rather than after: it is the number the operator is
 * agreeing to, and the moment to correct it is while it can still be corrected.
 * Sending it is optional and NOT sending it is the ordinary case — the server
 * then keeps the tariff's own rate, exactly as every switch did before a price
 * could be named.
 */
/**
 * The unlimited switch is a gated form, not a button, and asks for NO price
 * (2026-11-15, owner): the seat carries on at the rate it is billing at now
 * (`keep_rate`), pads and rentals keep counting on their own rows. The figure
 * is the SERVER's (`hourly_now`), said in the toast once it has answered —
 * nothing here works out a rate.
 */
describe("switching a session to unlimited", () => {
  const unlimitedNow = { seat: 1000, pads: 500, extras: 0, total: 1500 };

  test("offers nothing until the gate is ticked", async () => {
    await mountUnlimited();

    expect(screen.queryByTestId("unlimited-keep-rate")).toBeNull();
    expect(switchButton().disabled).toBe(true);
  });

  test("ticking it says it carries on at today's price: no price box at all", async () => {
    await mountUnlimited(session({ hourly_rate: null, tariff_hourly_rate: null }));
    await armUnlimited();

    expect(screen.getByTestId("unlimited-keep-rate").textContent).toContain("session.unlimitedKeepRate");
    expect(screen.queryByRole("textbox", { name: /unlimitedRate/ })).toBeNull();
    expect(document.querySelectorAll("[data-testid=unlimited-section] input[inputmode=decimal]")).toHaveLength(0);
    expect(switchButton().disabled).toBe(false);
  });

  test("unticking the gate keeps the switch shut", async () => {
    await mountUnlimited();
    await armUnlimited();
    expect(switchButton().disabled).toBe(false);
    await armUnlimited();
    expect(switchButton().disabled).toBe(true);
  });

  test("sends keep-the-rate (no price) and toasts the SERVER's hourly figure", async () => {
    repo.makeUnlimited.mockResolvedValue({ session: session({ is_unlimited: true, ends_at: null }), hourlyNow: unlimitedNow });
    await mountUnlimited();
    await armUnlimited();

    await act(async () => { fireEvent.click(switchButton()); });
    await answerConfirm(true);

    expect(repo.makeUnlimited).toHaveBeenCalledWith(42);
    expect(toast.message).toHaveBeenCalledWith("success", "session.unlimitedDoneKept 1500session.perHourShort {1}");
  });

  test("an older backend that sends no hourly figure: a plain toast, no invented price", async () => {
    repo.makeUnlimited.mockResolvedValue({ session: session({ is_unlimited: true, ends_at: null }), hourlyNow: null });
    await mountUnlimited();
    await armUnlimited();
    await act(async () => { fireEvent.click(switchButton()); });
    await answerConfirm(true);
    expect(toast.message).toHaveBeenCalledWith("success", "session.unlimitedDone");
  });

  test("a session that already has no end states the fact", async () => {
    await mountUnlimited(session({ is_unlimited: true, ends_at: null }));

    expect(screen.queryByText("session.unlimitedGate")).toBeNull();
    expect(screen.queryByTestId("unlimited-keep-rate")).toBeNull();
  });
});

/**
 * A refusal that names the alternative.
 *
 * The server answers "the seat is reserved" with the grant it WOULD accept
 * (`max_minutes`) and the moment the seat is claimed. Before this, the dialog
 * printed the sentence and nothing else, and a cashier found the ceiling by
 * halving the number until one went through.
 */
describe("when the seat is reserved ahead", () => {
  /** The shape `ApiError` carries — a `body` with the server's JSON. */
  const refusal = (over: Record<string, unknown> = {}) =>
    Object.assign(new Error("The seat is reserved"), {
      body: {
        message: "The seat is reserved",
        code: "seat_reserved",
        latest_allowed_end: "2026-09-03T15:00:00.000Z",
        max_minutes: 50,
        ...over,
      },
    });

  /**
   * Press any preset. `t` echoes keys and the presets all interpolate into the
   * same one, so they are indistinguishable by name — the first is as good as
   * any, and which one it was does not matter to what is being asserted.
   */
  const pressAPreset = async () => { await requestGrant(); };

  /** The offer's own button, found through its container rather than by name. */
  const offerButton = () => {
    const hint = screen.getByText(/session.seatClaimedFrom/);
    const box = hint.parentElement as HTMLElement;
    return within(box).getByRole("button");
  };

  test("offers exactly the grant the server said it would take", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    await mount();
    await pressAPreset();

    expect(screen.getByText(/session.seatClaimedFrom/)).toBeTruthy();

    repo.addTime.mockResolvedValueOnce(session());
    await act(async () => {
      fireEvent.click(offerButton());
    });

    // The SERVER's figure, not a preset.
    expect(repo.addTime).toHaveBeenLastCalledWith(42, 50, undefined, undefined);
  });

  test("offers nothing when the reservation has already started", async () => {
    // Zero headroom must not become a button that grants zero minutes.
    repo.addTime.mockRejectedValueOnce(refusal({ max_minutes: 0 }));
    await mount();
    await pressAPreset();

    expect(screen.queryByText(/session.seatClaimed/)).toBeNull();
  });

  test("offers nothing after an unrelated refusal", async () => {
    repo.addTime.mockRejectedValueOnce(
      Object.assign(new Error("Session not active"), {
        body: { message: "Session not active" },
      }),
    );
    await mount();
    await pressAPreset();

    expect(screen.queryByText(/session.seatClaimed/)).toBeNull();
  });

  test("the offer is cleared once something succeeds", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    await mount();
    await pressAPreset();
    expect(screen.getByText(/session.seatClaimedFrom/)).toBeTruthy();

    repo.addTime.mockResolvedValueOnce(session());
    await act(async () => {
      fireEvent.click(offerButton());
    });

    expect(screen.queryByText(/session.seatClaimed/)).toBeNull();
  });
});

/**
 * "…or finish on another seat."
 *
 * The refusal already names the most this seat can give. When that is not what
 * the player asked for, the server is asked where they COULD finish and the
 * cashier gets one press per candidate. The list is stale by construction, so
 * the press sends a normal request and a refusal is a correct outcome.
 */
describe("moving the player to another seat", () => {
  const refusal = () =>
    Object.assign(new Error("The seat is reserved"), {
      body: {
        message: "The seat is reserved",
        code: "seat_reserved",
        latest_allowed_end: "2026-09-03T14:40:00.000Z",
        max_minutes_here: 10,
        max_minutes: 10,
      },
    });

  const options = (alternatives: unknown[]) => ({
    can_extend_here: false,
    reason: "seat_reserved",
    current: {},
    requested_minutes: 30,
    alternatives,
  });

  const seat = (over: Record<string, unknown> = {}) => ({
    place_id: 91,
    pc_id: 191,
    number: 9,
    name: null,
    platform: "ps5",
    type: "standard",
    hourly_rate: 1500,
    free_from: "2026-09-03T14:20:00.000Z",
    free_until: "2026-09-03T15:00:00.000Z",
    ...over,
  });

  const pressAPreset = async () => { await requestGrant(); };

  /**
   * The card for a seat, found by the number it shows.
   *
   * ⚠️ Scoped to the seat buttons — the ones carrying `aria-pressed` — rather
   * than searched by text across the whole dialog. The seat number now also
   * appears in the "now on №N -> continue on №M" line above the list, and a
   * bare `getByText` matches both and throws.
   */
  const cardFor = (label: string) =>
    screen
      .getAllByRole("button")
      .find(
        (b) => b.getAttribute("aria-pressed") !== null && (b.textContent ?? "").includes(label),
      ) as HTMLButtonElement;

  const confirmButton = () =>
    screen.getByRole("button", { name: "session.moveConfirm" }) as HTMLButtonElement;

  test("explains WHY the seat cannot take it, before offering anything", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat()]));
    await mount();
    await pressAPreset();

    expect(screen.getByText("session.moveWhyTitle")).toBeTruthy();
    // …and says how much was asked for, so the cards are read in context.
    expect(screen.getByText(/session.moveRequested/)).toBeTruthy();
  });

  test("offers the seats the server says can take the grant", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat(), seat({ place_id: 92, number: 10 })]));
    await mount();
    await pressAPreset();

    expect(screen.getByText("session.moveTitle")).toBeTruthy();
    expect(cardFor("№9")).toBeTruthy();
    expect(cardFor("№10")).toBeTruthy();
  });

  test("cannot confirm until a seat is chosen", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat()]));
    await mount();
    await pressAPreset();

    expect(confirmButton().disabled).toBe(true);

    await act(async () => {
      fireEvent.click(cardFor("№9"));
    });

    expect(confirmButton().disabled).toBe(false);
  });

  test("moves to the seat that was CHOSEN, for the minutes that were refused", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(
      options([seat(), seat({ place_id: 92, number: 10 })]),
    );
    await mount();
    await pressAPreset();

    // Pick the SECOND one, so a hardcoded "first in the list" fails here.
    await act(async () => {
      fireEvent.click(cardFor("№10"));
    });

    repo.transferExtension.mockResolvedValueOnce(session());
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(repo.transferExtension).toHaveBeenCalledWith(42, 92, expect.any(Number));
  });

  test("marks the chosen seat, and only that one", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(
      options([seat(), seat({ place_id: 92, number: 10 })]),
    );
    await mount();
    await pressAPreset();

    await act(async () => {
      fireEvent.click(cardFor("№10"));
    });

    expect(cardFor("№10").getAttribute("aria-pressed")).toBe("true");
    expect(cardFor("№9").getAttribute("aria-pressed")).toBe("false");
  });

  test("a seat taken between opening and confirming is announced by number", async () => {
    // The list was drawn from a read-only snapshot; a phone can take a seat
    // while the modal is open. The SERVER catches it — this only checks that
    // the refusal reaches the cashier as a sentence naming the seat, so they
    // pick again instead of wondering what failed.
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat({ place_id: 92, number: 10 })]));
    await mount();
    await pressAPreset();
    toast.warning.mockClear();

    repo.transferExtension.mockRejectedValueOnce(refusal());
    await act(async () => {
      fireEvent.click(cardFor("№10"));
    });
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(String(toast.warning.mock.calls[0][0])).toContain("№10");
    // ⚠️ And it is a WARNING, not a success — the move did not happen.
    expect(toast.message).not.toHaveBeenCalledWith("success", expect.anything());
  });

  test("a move that succeeds announces success, not a warning", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat({ place_id: 92, number: 10 })]));
    await mount();
    await pressAPreset();
    toast.warning.mockClear();
    toast.message.mockClear();

    repo.transferExtension.mockResolvedValueOnce(session());
    await act(async () => {
      fireEvent.click(cardFor("№10"));
    });
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith("success", expect.stringContaining("№10"));
  });

  test("says so when nothing is free rather than showing an empty list", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([]));
    await mount();
    await pressAPreset();

    expect(screen.getByText("session.moveNone")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.moveConfirm" })).toBeNull();
  });

  test("asks for nothing after a refusal that is not about the seat", async () => {
    repo.addTime.mockRejectedValueOnce(
      Object.assign(new Error("Session not active"), { body: { message: "Session not active" } }),
    );
    await mount();
    await pressAPreset();

    expect(repo.extensionOptions).not.toHaveBeenCalled();
    expect(screen.queryByText("session.moveTitle")).toBeNull();
  });

  test("a failed lookup does not bury the refusal the cashier needs to read", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockRejectedValueOnce(new Error("network"));
    await mount();
    await pressAPreset();

    expect(screen.getByText("session.moveNone")).toBeTruthy();
  });
});

describe("adding time by money (2026-11-07)", () => {
  const toMoney = async () => { await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "session.addTimeByMoney" })); }); };
  const typeMoney = async (value: string) => {
    await act(async () => { fireEvent.change(screen.getByLabelText("session.addTimeMoney"), { target: { value } }); });
  };
  const moneyConfirm = () => screen.getByTestId("grant-money-confirm") as HTMLButtonElement;

  test("700 is the server's 42 minutes, shown before anything is sent, and sent as money", async () => {
    repo.addTimeByAmount.mockResolvedValue(session());
    await mount();
    await toMoney();
    expect(moneyConfirm().disabled).toBe(true);

    await typeMoney("700");
    await settle();

    expect(repo.timeQuoteByAmount).toHaveBeenCalledWith(42, 700);
    expect(screen.getByTestId("grant-money-result").dataset.minutes).toBe("42");
    expect(moneyConfirm().disabled).toBe(false);
    await act(async () => { fireEvent.click(moneyConfirm()); });

    expect(repo.addTimeByAmount).toHaveBeenCalledWith(42, 700, undefined);
    expect(repo.addTime).not.toHaveBeenCalled();
  });

  test("a seat without a plan says what its rate will charge for those minutes", async () => {
    repo.timeQuoteByAmount.mockResolvedValue({
      minutes: 20, hourly_rate: 1000, charge: 333.33, standard_charge: 333.33, price_editable: false, is_free: false, amount: 333,
    });
    await mount();
    await toMoney();
    await typeMoney("333");
    await settle();

    expect(screen.getByTestId("grant-money-result").textContent).toContain("session.addTimeMoneyAtRate");
  });

  test("an empty or zero amount asks nothing and confirms nothing", async () => {
    await mount();
    await toMoney();
    await typeMoney("0");
    await settle();

    expect(repo.timeQuoteByAmount).not.toHaveBeenCalled();
    expect(moneyConfirm().disabled).toBe(true);
  });

  test("the server's refusal is shown and nothing can be confirmed", async () => {
    repo.timeQuoteByAmount.mockRejectedValue(new Error("Too little for a minute."));
    await mount();
    await toMoney();
    await typeMoney("5");
    await settle();

    expect(screen.getByText("Too little for a minute.")).toBeTruthy();
    expect(moneyConfirm().disabled).toBe(true);
  });

  test("a changed amount is never confirmed on the answer for the old one", async () => {
    await mount();
    await toMoney();
    await typeMoney("700");
    await settle();
    expect(moneyConfirm().disabled).toBe(false);

    // The answer for 800 has not come yet.
    repo.timeQuoteByAmount.mockImplementation(() => new Promise(() => {}));
    await typeMoney("800");
    await settle();

    expect(moneyConfirm().disabled).toBe(true);
    expect(screen.queryByTestId("grant-money-result")).toBeNull();
  });

  test("the title is «+ Время»", async () => {
    await mount();
    expect(screen.getByRole("heading", { name: /^session\.addTime/ })).toBeTruthy();
  });
});

/**
 * One «+ Время» for every mode (2026-11-07, owner): the dialog says the mode
 * and what is left, and offers what fits — more time and «Безлимит» on a
 * timed seat, a fixed time on an unlimited one — and «Не оплачено».
 */
describe("one «+ Время» for every mode (2026-11-07)", () => {
  test("a timed seat: its mode and what is left, more time, and «Безлимит»", async () => {
    await mount(session({ ends_at: new Date(Date.now() + 25 * 60_000 + 30_000).toISOString() }));
    expect(screen.getByTestId("options-mode").textContent).toContain("session.modeTimed");
    expect(screen.getByTestId("options-remaining").textContent).toContain("26");
    expect(screen.getByTestId("grant-duration-hours")).toBeTruthy();
    expect(screen.getByText("session.unlimitedGate")).toBeTruthy();
    expect(screen.queryByTestId("limit-section")).toBeNull();
  });

  test("an unlimited seat: its mode, no time left to show, and only a fixed time", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));
    expect(screen.getByTestId("options-mode").textContent).toContain("session.modeUnlimited");
    expect(screen.queryByTestId("options-remaining")).toBeNull();
    expect(screen.queryByTestId("grant-duration-hours")).toBeNull();
    expect(screen.queryByText("session.unlimitedGate")).toBeNull();
    expect(screen.getByTestId("limit-section")).toBeTruthy();
  });

  const unlimited = () => session({ is_unlimited: true, ends_at: null });
  const typeLimit = async (h: string, m: string) => {
    await act(async () => { fireEvent.change(screen.getByTestId("limit-duration-hours"), { target: { value: h } }); });
    await act(async () => { fireEvent.change(screen.getByTestId("limit-duration-minutes"), { target: { value: m } }); });
  };

  test("«⏱» on an older backend's answer (no plan in it): the length is sent and the old toast says the rate", async () => {
    repo.limitQuote.mockImplementation((_id: number, m: number) => Promise.resolve(limitQuoteOf(m)));
    repo.limit.mockResolvedValue({ session: session({ ends_at: "2026-11-15T17:10:00Z" }), hourlyNow: { seat: 1000, pads: 500, extras: 0, total: 1500 }, limit: null });
    const onClose = vi.fn();
    await act(async () => {
      render(
        <ConfirmProvider>
          <SessionOptionsDialog session={unlimited()} platform="ps5" onClose={onClose} onChanged={() => {}} />
        </ConfirmProvider>,
      );
    });
    const confirm = screen.getByTestId("limit-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await typeLimit("1", "30");
    await settle();
    expect(confirm.disabled).toBe(false);
    await act(async () => { fireEvent.click(confirm); });

    expect(repo.limit).toHaveBeenCalledWith(42, 90, "start");
    expect(onClose).toHaveBeenCalled();
    // The server's end and its per-hour figure: "until 21:10, at 1500/h".
    expect(toast.message).toHaveBeenCalledWith("success", `session.limitDoneRate ${clock("2026-11-15T17:10:00Z")} 1500session.perHourShort`);
  });

  test("a paused seat: nothing about time until it is resumed, «Не оплачено» still there", async () => {
    for (const s of [
      session({ is_unlimited: true, ends_at: null, paused_at: "2026-11-07T15:00:00Z" }),
      session({ paused_at: "2026-11-07T15:00:00Z" }),
    ]) {
      await mount(s);
      expect(screen.getByTestId("options-paused")).toBeTruthy();
      expect(screen.queryByTestId("limit-section")).toBeNull();
      expect(screen.queryByTestId("grant-duration-hours")).toBeNull();
      expect(screen.queryByText("session.unlimitedGate")).toBeNull();
      expect(screen.getByTestId("unpaid-switch")).toBeTruthy();
      cleanup();
    }
  });

  test("a refused limit shows the server's sentence and keeps the dialog", async () => {
    repo.limitQuote.mockImplementation((_id: number, m: number) => Promise.resolve(limitQuoteOf(m)));
    repo.limit.mockRejectedValue(new Error("The seat is booked at 16:00."));
    const onClose = vi.fn();
    await act(async () => {
      render(
        <ConfirmProvider>
          <SessionOptionsDialog session={unlimited()} platform="ps5" onClose={onClose} onChanged={() => {}} />
        </ConfirmProvider>,
      );
    });
    await typeLimit("1", "00");
    await settle();
    await act(async () => { fireEvent.click(screen.getByTestId("limit-confirm")); });

    expect(screen.getByText("The seat is booked at 16:00.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * «Задать время» on an unlimited seat (2026-11-15, owner — production seat
 * #258: "1 hour" set ten seconds after the start ran from the press and an
 * hour at 1000 banked 1100). Two choices, both the SERVER's: «Всего с начала
 * места · до 19:15» — the default — and «Ещё 1 ч от сейчас · до 19:25». Each
 * shows the end and what the seat's time costs in all; nothing is worked out
 * here, and the confirm waits for a quote of exactly the length on screen.
 */
describe("«Задать время»: in all from the start, or more from now (2026-11-15)", () => {
  const unlimited = () => session({ is_unlimited: true, ends_at: null, started_at: "2026-11-15T14:15:37Z" });
  const typeLimit = async (h: string, m: string) => {
    await act(async () => { fireEvent.change(screen.getByTestId("limit-duration-hours"), { target: { value: h } }); });
    await act(async () => { fireEvent.change(screen.getByTestId("limit-duration-minutes"), { target: { value: m } }); });
  };
  const card = (key: "start" | "now") => screen.getByTestId(`limit-from-${key}`);
  const radio = (key: "start" | "now") => within(card(key)).getByRole("radio") as HTMLInputElement;
  const confirmButton = () => screen.getByTestId("limit-confirm") as HTMLButtonElement;
  const mountLimit = async (onClose = vi.fn()) => {
    await act(async () => {
      render(
        <ConfirmProvider>
          <SessionOptionsDialog session={unlimited()} platform="ps5" onClose={onClose} onChanged={() => {}} />
        </ConfirmProvider>,
      );
    });
    return onClose;
  };

  beforeEach(() => {
    repo.limitQuote.mockImplementation((_id: number, m: number) => Promise.resolve(limitQuoteOf(m)));
  });

  test("both choices carry the server's end and figure, and «in all» is chosen", async () => {
    await mountLimit();
    await typeLimit("1", "00");
    await settle();

    expect(repo.limitQuote).toHaveBeenLastCalledWith(42, 60);
    expect(radio("start").checked).toBe(true);
    expect(radio("now").checked).toBe(false);
    expect(card("start").textContent).toContain("session.limitFromStart");
    expect(card("start").textContent).toContain(`session.limitUntil ${clock("2026-11-15T15:15:37Z")}`);
    expect(card("start").textContent).toContain("session.limitTimeTotal 1000");
    expect(card("now").textContent).toContain("session.limitFromNow 1 time.hourShort");
    expect(card("now").textContent).toContain(`session.limitUntil ${clock("2026-11-15T15:15:47Z")}`);
    expect(card("now").textContent).toContain("session.limitTimeTotal 1002.78");
    // What was played so far, as the server counted it.
    expect(screen.getByTestId("limit-played").textContent).toContain("session.limitPlayed 0 time.minShort");
  });

  test("the confirm sends «start» and the toast says the server's end and figure", async () => {
    repo.limit.mockResolvedValue({
      session: session({ ends_at: "2026-11-15T15:15:37Z" }), hourlyNow: { seat: 1000, pads: 0, extras: 0, total: 1000 },
      limit: { from: "start", minutes: 60, played_seconds: 10, hourly_rate: 1000, ends_at: "2026-11-15T15:15:37Z", time_total: 1000, charge: 997.22 },
    });
    const onClose = await mountLimit();
    await typeLimit("1", "00");
    await settle();
    await act(async () => { fireEvent.click(confirmButton()); });

    expect(repo.limit).toHaveBeenCalledWith(42, 60, "start");
    expect(toast.message).toHaveBeenCalledWith("success", `session.limitDoneStart ${clock("2026-11-15T15:15:37Z")} 1000`);
    expect(onClose).toHaveBeenCalled();
  });

  test("«from now» picked: the confirm sends «now», the toast names the length added", async () => {
    repo.limit.mockResolvedValue({
      session: session({ ends_at: "2026-11-15T15:15:47Z" }), hourlyNow: null,
      limit: { from: "now", minutes: 60, played_seconds: 10, hourly_rate: 1000, ends_at: "2026-11-15T15:15:47Z", time_total: 1002.78, charge: 1000 },
    });
    await mountLimit();
    await typeLimit("1", "00");
    await settle();
    await act(async () => { fireEvent.click(radio("now")); });
    expect(radio("now").checked).toBe(true);
    await act(async () => { fireEvent.click(confirmButton()); });

    expect(repo.limit).toHaveBeenCalledWith(42, 60, "now");
    expect(toast.message).toHaveBeenCalledWith("success", `session.limitDoneNow ${clock("2026-11-15T15:15:47Z")} 1 time.hourShort 1002.78`);
  });

  test("played longer than «in all»: the server's sentence on that choice, nothing sent until «from now» is chosen", async () => {
    const longer = "The player has already played longer: 1 h 10 min. Choose a longer time, or count it from now.";
    repo.limitQuote.mockImplementation((_id: number, m: number) => Promise.resolve(limitQuoteOf(m, {
      played_seconds: 4200, start: { available: false, from: "start", message: longer },
    })));
    repo.limit.mockResolvedValue({ session: session({ ends_at: "2026-11-15T16:25:37Z" }), hourlyNow: null, limit: null });
    await mountLimit();
    await typeLimit("1", "00");
    await settle();

    expect(card("start").textContent).toContain(longer);
    expect(radio("start").disabled).toBe(true);
    // Not drawn as chosen while it cannot be: nothing looks picked yet.
    expect(radio("start").checked).toBe(false);
    expect(radio("now").checked).toBe(false);
    expect(confirmButton().disabled).toBe(true);

    await act(async () => { fireEvent.click(radio("now")); });
    expect(confirmButton().disabled).toBe(false);
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(repo.limit).toHaveBeenCalledWith(42, 60, "now");
  });

  test("nothing is confirmed on a stale figure: the confirm waits for the quote of exactly this length", async () => {
    await mountLimit();
    await typeLimit("1", "00");
    await settle();
    expect(confirmButton().disabled).toBe(false);

    // A new length: the quote for 60 is not one for 90.
    await act(async () => { fireEvent.change(screen.getByTestId("limit-duration-minutes"), { target: { value: "30" } }); });
    expect(confirmButton().disabled).toBe(true);
    await settle();
    expect(repo.limitQuote).toHaveBeenLastCalledWith(42, 90);
    expect(confirmButton().disabled).toBe(false);
  });

  test("a refused quote shows its reason and no choice", async () => {
    repo.limitQuote.mockRejectedValue(new Error("No price is set for this seat."));
    await mountLimit();
    await typeLimit("1", "00");
    await settle();

    expect(screen.getByText("No price is set for this seat.")).toBeTruthy();
    expect(screen.queryByTestId("limit-from-start")).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });
});

/**
 * «Не оплачено» lives in this dialog and in Start, never on the card
 * (2026-11-07, owner). Flipped, it is the server's at once; a grant made
 * while it is on carries it, so the time it adds is never counted as paid;
 * a grant made while it is off says nothing about it, so a stale dialog never
 * switches off what another desk switched on.
 */
describe("«Не оплачено» in «+ Время» (2026-11-07)", () => {
  const unpaidSwitch = () => screen.getByTestId("unpaid-switch") as HTMLButtonElement;

  test("shows the server's state and flips it on the server", async () => {
    repo.setUnpaid.mockResolvedValue(session({ unpaid_since: "2026-11-07T15:50:00Z" }));
    await mount();
    expect(unpaidSwitch().getAttribute("aria-checked")).toBe("false");

    await act(async () => { fireEvent.click(unpaidSwitch()); });

    expect(repo.setUnpaid).toHaveBeenCalledWith(42, true);
    expect(unpaidSwitch().getAttribute("aria-checked")).toBe("true");
  });

  test("a grant while it is on carries it — by time and by money", async () => {
    repo.addTime.mockResolvedValue(session({ unpaid_since: "2026-11-07T15:50:00Z" }));
    repo.addTimeByAmount.mockResolvedValue(session({ unpaid_since: "2026-11-07T15:50:00Z" }));
    await mount(session({ unpaid_since: "2026-11-07T15:50:00Z" }));
    await requestGrant(30);
    expect(repo.addTime).toHaveBeenCalledWith(42, 30, undefined, true);

    cleanup();
    await mount(session({ unpaid_since: "2026-11-07T15:50:00Z" }));
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "session.addTimeByMoney" })); });
    await act(async () => { fireEvent.change(screen.getByLabelText("session.addTimeMoney"), { target: { value: "700" } }); });
    await settle();
    await act(async () => { fireEvent.click(screen.getByTestId("grant-money-confirm")); });
    expect(repo.addTimeByAmount).toHaveBeenCalledWith(42, 700, true);
  });

  test("a grant while it is off says nothing about it", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();
    await requestGrant(30);
    expect(repo.addTime).toHaveBeenCalledWith(42, 30, undefined, undefined);
    expect(repo.setUnpaid).not.toHaveBeenCalled();
  });

  test("an unlimited seat has it too; a free one cannot owe, so it is greyed", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));
    expect(unpaidSwitch()).toBeTruthy();
    cleanup();
    await mount(session({ is_free: true }));
    expect(unpaidSwitch().disabled).toBe(true);
  });

  test("a refused flip shows the server's sentence and leaves the switch as it was", async () => {
    repo.setUnpaid.mockRejectedValue(new Error("The session is not active."));
    await mount();
    await act(async () => { fireEvent.click(unpaidSwitch()); });
    expect(screen.getByText("The session is not active.")).toBeTruthy();
    expect(unpaidSwitch().getAttribute("aria-checked")).toBe("false");
  });
});

/**
 * «+ Время» on a seat paid AHEAD (2026-11-15): «Оплачено сейчас» records the
 * grant's charge as more cash paid ahead, so the change at Stop counts it.
 * Offered only on such a seat, never with «Не оплачено», off by default.
 */
describe("«Оплачено сейчас» in «+ Время»", () => {
  const paidNow = () => screen.queryByTestId("time-prepaid-switch") as HTMLButtonElement | null;

  test("not offered on a seat paid nothing ahead", async () => {
    await mount(session());
    expect(paidNow()).toBeNull();
  });

  test("not offered while «Не оплачено» is on", async () => {
    await mount(session({ prepaid_amount: 2000, unpaid_since: "2026-11-15T14:00:00Z" }));
    expect(paidNow()).toBeNull();
  });

  test("on a prepaid seat: off by default, the grant as before", async () => {
    repo.addTime.mockResolvedValue(session({ prepaid_amount: 2000 }));
    await mount(session({ prepaid_amount: 2000 }));
    expect(paidNow()!.getAttribute("aria-checked")).toBe("false");
    await requestGrant(30);
    expect(repo.addTime).toHaveBeenCalledWith(42, 30, undefined, undefined);
  });

  test("on: the grant is sent paid ahead", async () => {
    repo.addTime.mockResolvedValue(session({ prepaid_amount: 2500 }));
    await mount(session({ prepaid_amount: 2000 }));
    await act(async () => { fireEvent.click(paidNow()!); });
    await requestGrant(30);
    expect(repo.addTime).toHaveBeenCalledWith(42, 30, undefined, undefined, true);
  });

  test("paid now by card (2026-11-17): the method rides with it; no control while off", async () => {
    repo.addTime.mockResolvedValue(session({ prepaid_amount: 2500 }));
    await mount(session({ prepaid_amount: 2000 }));
    expect(screen.queryByTestId("payment-editor")).toBeNull();
    await act(async () => { fireEvent.click(paidNow()!); });
    // Shown once the server has priced the grant — a split must add up to it.
    await typeMinutes("30");
    await settle();
    expect(screen.getByTestId("payment-editor")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-card")); });
    await act(async () => { fireEvent.click(confirmGrant()); });
    expect(repo.addTime).toHaveBeenCalledWith(42, 30, undefined, undefined, true, { payment_method: "card" });
  });
});

/**
 * «Напоминание» (2026-11-15, owner): the player asks to be reminded in 2 h.
 * The same h:mm field as everywhere, an optional name, one button that says
 * what it does; once set, when it rings and how to change or cancel it.
 */
describe("the reminder section", () => {
  const typeReminder = async (h: string, m: string) => {
    await act(async () => { fireEvent.change(screen.getByTestId("reminder-duration-hours"), { target: { value: h } }); });
    await act(async () => { fireEvent.change(screen.getByTestId("reminder-duration-minutes"), { target: { value: m } }); });
  };
  const setButton = () => screen.getByTestId("reminder-set") as HTMLButtonElement;

  test("set: in 2 h with a name, sent as minutes and the note", async () => {
    repo.setReminder.mockResolvedValue(session({ reminder: { at: "2026-11-15T16:40:00Z", set_at: "2026-11-15T14:40:00Z", minutes: 120, note: "Арам", set_by_user_id: 1, fired_at: null } }));
    await mount(session({ is_unlimited: true, ends_at: null }));
    expect(setButton().disabled).toBe(true);
    await typeReminder("2", "00");
    await act(async () => { fireEvent.change(screen.getByTestId("reminder-note"), { target: { value: "Арам" } }); });
    expect(setButton().textContent).toBe("session.reminder.set");
    await act(async () => { fireEvent.click(setButton()); });
    expect(repo.setReminder).toHaveBeenCalledWith(42, 120, "Арам");
    // Now pending: when, and change / cancel.
    expect(screen.getByTestId("reminder-pending").textContent).toContain("Арам");
    expect(screen.getByTestId("reminder-cancel")).toBeTruthy();
  });

  test("more than 10 h is not offered (the server takes 1..600)", async () => {
    await mount(session());
    await typeReminder("10", "01");
    expect(setButton().disabled).toBe(true);
    expect(screen.getByTestId("reminder-too-long")).toBeTruthy();
  });

  test("a pending reminder: cancel clears it on the server", async () => {
    const pending = { at: "2026-11-15T16:40:00Z", set_at: "2026-11-15T14:40:00Z", minutes: 120, note: null, set_by_user_id: 1, fired_at: null };
    repo.clearReminder.mockResolvedValue(session({ reminder: null }));
    await mount(session({ reminder: pending }));
    expect(screen.queryByTestId("reminder-duration-hours")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("reminder-cancel")); });
    expect(repo.clearReminder).toHaveBeenCalledWith(42);
    expect(screen.getByTestId("reminder-duration-hours")).toBeTruthy();
  });

  test("«Изменить» opens the field again over the pending one", async () => {
    const pending = { at: "2026-11-15T16:40:00Z", set_at: "2026-11-15T14:40:00Z", minutes: 120, note: "Арам", set_by_user_id: 1, fired_at: null };
    await mount(session({ reminder: pending }));
    await act(async () => { fireEvent.click(screen.getByTestId("reminder-change")); });
    expect(screen.getByTestId("reminder-duration-hours")).toBeTruthy();
    expect((screen.getByTestId("reminder-note") as HTMLInputElement).value).toBe("Арам");
  });
});
