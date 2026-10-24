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
  makeUnlimited: vi.fn(),
  setFree: vi.fn(),
  extensionOptions: vi.fn(),
  transferExtension: vi.fn(),
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
    makeUnlimited: (...a: unknown[]) => repo.makeUnlimited(...a),
    setFree: (...a: unknown[]) => repo.setFree(...a),
    extensionOptions: (...a: unknown[]) => repo.extensionOptions(...a),
    transferExtension: (...a: unknown[]) => repo.transferExtension(...a),
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
        : k,
    money: (n: number) => String(n),
    lang: "en",
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

const typeAmount = async (value: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("session.timeAmount"), { target: { value } });
  });
};

const chooseUnit = async (unit: "hours" | "minutes") => {
  await act(async () => {
    fireEvent.click(screen.getByRole("tab", {
      name: unit === "hours" ? "session.timeUnitHours" : "session.timeUnitMinutes",
    }));
  });
};

const confirmGrant = () =>
  screen.getByRole("button", { name: /session.timeAddConfirmPriced/ }) as HTMLButtonElement;

/** Choose N minutes, wait for the server's price, confirm. */
const requestGrant = async (minutes = 10) => {
  await chooseUnit("minutes");
  await typeAmount(String(minutes));
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

beforeEach(() => {
  auth.role = "company_owner";
  Object.values(repo).forEach((fn) => fn.mockReset());
  // Cleared per test: "announced nothing" is only meaningful if an earlier
  // test's toast cannot be mistaken for this one's.
  toast.message.mockReset();
  prices.fee = 500;
  // The server's price for N minutes at a 1 000/h session: what the confirm
  // names and waits for.
  repo.timeQuote.mockImplementation((_id: number, m: number) =>
    Promise.resolve({ minutes: m, hourly_rate: 1000, charge: (m * 1000) / 60, is_free: false }));
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
 * Arm the unlimited switch the way the form now asks for it: tick the gate,
 * then price it. Nothing about the switch is offered until both are done —
 * removing a seat's end cannot be undone, so it reads as a deliberate act
 * rather than a button sitting there waiting to be clicked.
 */
const armUnlimited = async (price = "1500") => {
  await act(async () => {
    fireEvent.click(screen.getByText("session.unlimitedGate"));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("session.unlimitedRate"), { target: { value: price } });
  });
};

const switchButton = () =>
  screen.getByRole("button", { name: "session.unlimitedApply" }) as HTMLButtonElement;

describe("time and the ceiling", () => {
  test("hours by default, minutes on the other tab, and the minutes are what is sent", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();

    // Hours first: 1–5 h.
    expect(screen.getByRole("tab", { name: "session.timeUnitHours" }).getAttribute("aria-selected")).toBe("true");
    const hourPresets = screen.getAllByRole("button", { name: /time\.hourShort$/ });
    expect(hourPresets).toHaveLength(5);

    await chooseUnit("minutes");
    expect(screen.getAllByRole("button", { name: /time\.minShort$/ })).toHaveLength(9);
    await chooseUnit("hours");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "1 time.hourShort" })); });
    await settle();
    await act(async () => { fireEvent.click(confirmGrant()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 60);
  });

  test("do not offer extra time on a session that has no end", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));

    expect(screen.queryByRole("button", { name: /session.timeAddConfirmPriced/ })).toBeNull();
    expect(screen.queryByLabelText("session.timeAmount")).toBeNull();
    expect(screen.getByText("session.timeNotApplicable")).toBeTruthy();
    expect(repo.timeQuote).not.toHaveBeenCalled();
  });

  test("show the booking refusal instead of silently doing nothing", async () => {
    repo.makeUnlimited.mockRejectedValue(new Error("This place is booked in the app."));
    await mount();
    await armUnlimited();

    await act(async () => {
      fireEvent.click(switchButton());
    });
    await answerConfirm(true);

    expect(screen.getByText("This place is booked in the app.")).toBeTruthy();
  });

  test("ask before lifting the ceiling, and do nothing if the answer is no", async () => {
    await mount();
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
    await mount();
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
    expect((screen.getByRole("button", { name: "1 time.hourShort" }) as HTMLButtonElement).disabled).toBe(true);
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

    expect(repo.addTime).toHaveBeenCalledWith(42, 120);
  });

  test("half an hour is a legitimate thing to type", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();
    await typeAmount("1,5");
    await settle();
    await act(async () => { fireEvent.click(confirmGrant()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 90);
  });

  test("minutes typed on the minutes tab are sent as typed", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();
    await requestGrant(45);

    expect(repo.addTime).toHaveBeenCalledWith(42, 45);
  });

  test("switching the unit keeps the length, never re-reads the number", async () => {
    await mount();
    await typeAmount("2");
    await chooseUnit("minutes");

    expect((screen.getByLabelText("session.timeAmount") as HTMLInputElement).value).toBe("120");
  });

  test.each([
    ["nothing", ""],
    ["a zero", "0"],
    ["a negative", "-30"],
    ["words", "abc"],
    ["a fraction of a minute", "1.5"],
    ["more than the server's ceiling", "601"],
  ])("refuses %s", async (_name, value) => {
    await mount();
    await chooseUnit("minutes");
    await typeAmount(value);
    await settle();

    expect(confirmGrant().disabled).toBe(true);
    expect(repo.timeQuote).not.toHaveBeenCalled();
    expect(repo.addTime).not.toHaveBeenCalled();
  });

  test("says why, but only once something has been typed", async () => {
    await mount();
    expect(screen.queryByText("session.timeInvalid")).toBeNull();

    await typeAmount("0");
    expect(screen.getByText("session.timeInvalid")).toBeTruthy();
  });

  test("a refused grant keeps what was typed", async () => {
    repo.addTime.mockRejectedValue(new Error("Seat is booked at 20:00"));
    await mount();
    await requestGrant(30);

    expect(screen.getByText("Seat is booked at 20:00")).toBeTruthy();
    expect((screen.getByLabelText("session.timeAmount") as HTMLInputElement).value).toBe("30");
  });

  test("the price shown is the server's, for exactly the length chosen", async () => {
    await mount();
    await typeAmount("3");
    await settle();

    expect(repo.timeQuote).toHaveBeenLastCalledWith(42, 180);
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
 * The unlimited switch is a gated form, not a button.
 *
 * The checkbox is the gate: until it is ticked nothing about the switch is
 * offered — not the price, not the button. Removing a seat's end cannot be
 * undone, and the form should read as a deliberate act.
 *
 * The price is then REQUIRED and typed. It used to be shown up front from the
 * seat's configuration, with a "check the tariff settings" error when there was
 * none — which tells an operator holding a player to go and edit a settings
 * screen. It is prefilled from the seat when there is a price and typed when
 * there is not; the server validates it either way.
 */
describe("switching a session to unlimited", () => {
  test("offers nothing until the gate is ticked", async () => {
    await mount();

    expect(screen.queryByLabelText("session.unlimitedRate")).toBeNull();
    expect(switchButton().disabled).toBe(true);
  });

  test("ticking it reveals a required price, prefilled from the seat", async () => {
    await mount(session({ hourly_rate: null, tariff_hourly_rate: 1500 }));

    await act(async () => {
      fireEvent.click(screen.getByText("session.unlimitedGate"));
    });

    const input = screen.getByLabelText("session.unlimitedRate") as HTMLInputElement;
    expect(input.value).toBe("1500");
    expect(switchButton().disabled).toBe(false);
  });

  test("a seat with no configured price asks for one instead of refusing", async () => {
    await mount(session({ hourly_rate: null, tariff_hourly_rate: null }));

    await act(async () => {
      fireEvent.click(screen.getByText("session.unlimitedGate"));
    });

    // An empty box to fill, not a sentence about settings.
    const input = screen.getByLabelText("session.unlimitedRate") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(switchButton().disabled).toBe(true);

    await act(async () => {
      fireEvent.change(input, { target: { value: "1800" } });
    });
    expect(switchButton().disabled).toBe(false);
  });

  test.each([
    ["empty", ""],
    ["a zero", "0"],
    ["a negative", "-100"],
    ["words", "abc"],
  ])("keeps the switch shut on %s", async (_name, value) => {
    await mount(session({ hourly_rate: null, tariff_hourly_rate: null }));
    await armUnlimited(value);

    expect(switchButton().disabled).toBe(true);
    expect(repo.makeUnlimited).not.toHaveBeenCalled();
  });

  test("unticking the gate keeps the switch shut, price or no price", async () => {
    await mount();
    await armUnlimited("2000");
    expect(switchButton().disabled).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByText("session.unlimitedGate"));
    });

    // The price is still in state — the form does not throw away what was
    // typed — and the gate alone is what keeps the switch shut.
    expect(switchButton().disabled).toBe(true);
  });

  test("sends the price that was typed", async () => {
    repo.makeUnlimited.mockResolvedValue(session({ is_unlimited: true, ends_at: null }));
    await mount();
    await armUnlimited("2000");

    await act(async () => { fireEvent.click(switchButton()); });
    await answerConfirm(true);

    expect(repo.makeUnlimited).toHaveBeenCalledWith(42, 2000);
  });

  test("says the rule out loud once the gate is open", async () => {
    await mount();
    await armUnlimited();

    // "From now on" is the question an operator asks, and the wrong answer
    // would be somebody's receipt.
    expect(screen.getByText("session.unlimitedRateHint")).toBeTruthy();
  });

  test("a session that already has no end states the fact", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));

    expect(screen.getByText("session.unlimitedAlready")).toBeTruthy();
    expect(screen.queryByLabelText("session.unlimitedRate")).toBeNull();
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
    expect(repo.addTime).toHaveBeenLastCalledWith(42, 50);
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
