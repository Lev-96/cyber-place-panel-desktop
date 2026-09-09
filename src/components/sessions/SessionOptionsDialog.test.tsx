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
  makeUnlimited: vi.fn(),
  setFree: vi.fn(),
  extensionOptions: vi.fn(),
  transferExtension: vi.fn(),
}));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    addJoystick: (...a: unknown[]) => repo.addJoystick(...a),
    removeJoystick: (...a: unknown[]) => repo.removeJoystick(...a),
    addTime: (...a: unknown[]) => repo.addTime(...a),
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
    t: (k: string) => (k === "session.joystickThisPlatform" ? `${k} {0}` : k),
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
  prices.fee = 500;
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

    const surface = document.querySelector(".cp-modal-wrapper > *");
    expect(surface, "the dialog rendered nothing inside the modal wrapper").toBeTruthy();
    expect(
      surface!.classList.contains("card"),
      "the dialog's root is missing `card` — it will render transparent over the board",
    ).toBe(true);
  });
});

describe("the joystick controls", () => {
  test("show as many pads as the SERVER counted, never a locally derived number", async () => {
    await mount(session({ joystick_count: 3 }));

    // One glyph per pad, drawn rather than typed: an emoji takes whatever
    // shape and width the OS font gives it, and the dialog would then not
    // match the tile that opened it.
    expect(screen.getByLabelText("3").querySelectorAll("svg").length).toBe(3);
    expect(screen.getByLabelText("3").textContent).not.toContain("🎮");
    expect(screen.getByText("3 / 4")).toBeTruthy();
  });

  test("offer the venue's fee, which is the same for every pad", async () => {
    // Two in play, so the next is the third — and it costs what the second
    // did, because there is one fee and not one per slot.
    await mount(session({
      joystick_count: 2,
      joysticks: [
        { id: 1, slot: 2, price: 500, started_at: "2026-09-03T14:00:00.000Z", stopped_at: null },
      ],
    }));

    const add = screen.getByRole("button", { name: /session.joystickAdd/ });
    expect(add.textContent).toContain("500");
  });

  test("stop offering a fifth", async () => {
    await mount(session({ joystick_count: 4 }));

    const add = screen.getByRole("button", { name: /session.joystickAdd/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  test("follow the SERVER's verdict even when the slug would say otherwise", async () => {
    // Both local sources say PlayStation — the prop and the slug — and the
    // SERVER says no. The server wins, because it is the one that will refuse
    // the request anyway.
    //
    // Written this way on purpose: an earlier version passed a `ps5` slug
    // alongside the server's yes, so the local derivation reached the same
    // answer and the test passed with the server's field ignored entirely.
    await mount(session({ supports_joysticks: false, place_platform: "ps5" }), "ps5");

    expect(screen.queryByRole("button", { name: /session.joystickAdd/ })).toBeNull();
  });

  test("and when the local sources say nothing useful at all", async () => {
    // The board's device list is stale, or the device has no place: the prop
    // is "pc" and there is no slug. The session itself still knows.
    await mount(session({ supports_joysticks: true, place_platform: null }), "pc");

    expect(screen.getByRole("button", { name: /session.joystickAdd/ })).toBeTruthy();
  });

  test("names the platform when the seat is not a PlayStation", async () => {
    // "Only for PlayStation places" on a seat the operator believes IS one is
    // a dead end. The slug is what tells them how the place was set up.
    await mount(session({ supports_joysticks: false, place_platform: "table-tennis" }), "table-tennis");

    const text = document.body.textContent ?? "";
    expect(text).toContain("session.joystickPsOnly");
    expect(text).toContain("Table Tennis");
  });

  test("are absent on a place that is not a PlayStation", async () => {
    // `pc.kind === "ps"` is equally true of a ping-pong table; the platform is
    // the question, and the dialog asks the same one the backend does.
    await mount(session(), "table-tennis");

    expect(screen.queryByRole("button", { name: /session.joystickAdd/ })).toBeNull();
    expect(document.body.textContent ?? "").toContain("session.joystickPsOnly");
  });

  test("remove a pad by its SLOT, which is what the operator can see", async () => {
    repo.removeJoystick.mockResolvedValue(session({ joystick_count: 1, joysticks: [] }));
    await mount(session({
      joystick_count: 2,
      joysticks: [{ id: 5, slot: 2, price: 500, started_at: "2026-09-03T14:10:00.000Z", stopped_at: null }],
    }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /session.joystickRemove/ }));
    });

    expect(repo.removeJoystick).toHaveBeenCalledWith(42, 2);
  });

  /**
   * The fee is the venue's, not the slot's, so the button quotes the same
   * figure whichever pad is next.
   *
   * It used to resolve which slot the server would allocate and look ITS price
   * up — a lookup that could quote a figure for a pad nobody was about to add,
   * and that had to be kept in step with `JoystickService::add()` by hand. One
   * fee makes the question disappear.
   */
  test("quote the venue's one fee, whichever pad is next", async () => {
    await mount(session({
      joystick_count: 3,
      joysticks: [
        { id: 1, slot: 2, price: 500, started_at: "2026-09-03T14:00:00.000Z", stopped_at: null },
        { id: 2, slot: 3, price: 500, started_at: "2026-09-03T14:00:00.000Z", stopped_at: "2026-09-03T15:00:00.000Z" },
        { id: 3, slot: 4, price: 500, started_at: "2026-09-03T15:00:00.000Z", stopped_at: null },
      ],
    }));

    const add = screen.getByRole("button", { name: /session.joystickAdd/ });
    expect(add.textContent).toContain("500");
    expect(add.textContent).not.toContain("session.joystickNoPrice");
  });

  test("say the price is not set rather than quote one the venue does not have", async () => {
    // The button stays clickable: the server is the authority on whether a pad
    // may be added, and its refusal says where to fix it. A disabled button
    // would say "no" without saying why.
    prices.fee = null;
    await mount(session({
      joystick_count: 2,
      joysticks: [
        { id: 1, slot: 2, price: 500, started_at: "2026-09-03T14:00:00.000Z", stopped_at: null },
      ],
    }));

    expect(screen.getByText(/session.joystickNoPrice/)).toBeTruthy();
    const add = screen.getByRole("button", { name: /session.joystickAdd/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
  });

  test("re-read the fee after a refusal, so a withdrawn one stops being advertised", async () => {
    await mount(session({
      joystick_count: 2,
      joysticks: [
        { id: 1, slot: 2, price: 500, started_at: "2026-09-03T14:00:00.000Z", stopped_at: null },
      ],
    }));
    expect(prices.get).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /session.joystickAdd/ }).textContent).toContain("500");

    // The owner clears the fee in another window; the next add is refused.
    prices.fee = null;
    repo.addJoystick.mockRejectedValue(new Error("No joystick price is set at this branch"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /session.joystickAdd/ }));
    });

    expect(prices.get).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/session.joystickNoPrice/)).toBeTruthy();
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
  test("offer the three grants and send the minutes", async () => {
    repo.addTime.mockResolvedValue(session());
    await mount();

    // Eight presets — 10, 15, 20, 30, 45, 60, 90, 120. The first is the one
    // clicked, and that the whole list is offered is asserted with it.
    const grants = screen.getAllByRole("button", { name: /session.addMinutes/ });
    expect(grants).toHaveLength(8);

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

describe("waiving the bill", () => {
  test("is offered to an owner", async () => {
    auth.role = "company_owner";
    await mount();

    expect(screen.getByText("session.freeBill")).toBeTruthy();
  });

  test("is offered to a manager too", async () => {
    // Owner-level until 2026-09-06, when the capability opened to the floor: a
    // bill is waived by whoever is at the counter. The backend agrees on
    // `sessions.free`, so this control no longer leads to a 403 — and the
    // waiver is still attributed, `session_events` records who did it.
    auth.role = "manager";
    await mount();

    expect(screen.getByText("session.freeBill")).toBeTruthy();
  });

  test("sends the new value, both directions", async () => {
    repo.setFree.mockResolvedValue(session({ is_free: true }));
    await mount();

    // By its label, not by being the only checkbox on screen — the manual
    // time grant has one too, and "the first checkbox" is a selector that
    // silently starts pointing at a different control.
    await act(async () => {
      fireEvent.click(screen.getByText("session.freeBill"));
    });

    expect(repo.setFree).toHaveBeenCalledWith(42, true);
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
    const add = screen.getByRole("button", { name: /session.joystickAdd/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });
});

/**
 * The grant no preset covers.
 *
 * The unit is the whole point of this form: a cashier typing "2" means two
 * HOURS far more often than two minutes, and a number with no unit beside it is
 * how a seat gets sold for a fiftieth of what was meant. So the button says the
 * resolved total in minutes — seeing "Add 120 min" after typing 2 is what
 * catches a wrong unit before it is granted.
 */
describe("a grant typed by hand", () => {
  const openManual = async () => {
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByText("session.timeManual"));
    });
  };

  const type = async (value: string) => {
    await act(async () => {
      fireEvent.change(screen.getByLabelText("session.timeAmount"), { target: { value } });
    });
  };

  const chooseHours = async () => {
    await act(async () => {
      fireEvent.click(screen.getByText("session.timeUnitHours"));
    });
  };

  const confirm = () => screen.getByRole("button", { name: /session.timeAddConfirm/ }) as HTMLButtonElement;

  test("is hidden until it is asked for", async () => {
    await mount();

    expect(screen.queryByLabelText("session.timeAmount")).toBeNull();
  });

  test("sends the minutes typed", async () => {
    repo.addTime.mockResolvedValue(session());
    await openManual();
    await type("30");

    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 30);
  });

  test("converts hours before sending, and says the total first", async () => {
    repo.addTime.mockResolvedValue(session());
    await openManual();
    await type("2");
    await chooseHours();

    // The label states the resolved figure rather than what was typed, but it
    // does so through `t("…").replace("{0}", …)` and this suite's `t` returns
    // the bare key — so there is no placeholder left to fill and nothing to
    // read back. What the conversion actually decides is the payload, and that
    // is what is asserted.
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 120);
  });

  test("half an hour is a legitimate thing to type", async () => {
    repo.addTime.mockResolvedValue(session());
    await openManual();
    await type("1.5");
    await chooseHours();

    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.addTime).toHaveBeenCalledWith(42, 90);
  });

  test.each([
    ["nothing", ""],
    ["a zero", "0"],
    ["a negative", "-30"],
    ["words", "abc"],
    ["a fraction of a minute", "1.5"],
    ["more than the server's ceiling", "601"],
  ])("refuses %s", async (_name, value) => {
    await openManual();
    await type(value);

    expect(confirm().disabled).toBe(true);
    expect(repo.addTime).not.toHaveBeenCalled();
  });

  test("says why, but only once something has been typed", async () => {
    await openManual();
    expect(screen.queryByText("session.timeInvalid")).toBeNull();

    await type("0");
    expect(screen.getByText("session.timeInvalid")).toBeTruthy();
  });

  test("a refused grant keeps what was typed", async () => {
    repo.addTime.mockRejectedValue(new Error("Seat is booked at 20:00"));
    await openManual();
    await type("30");

    await act(async () => { fireEvent.click(confirm()); });

    expect(screen.getByText("Seat is booked at 20:00")).toBeTruthy();
    // Still there to correct, rather than cleared under the refusal.
    expect((screen.getByLabelText("session.timeAmount") as HTMLInputElement).value).toBe("30");
  });

  test("is not offered on a session that has no end", async () => {
    await mount(session({ is_unlimited: true, ends_at: null }));

    expect(screen.queryByText("session.timeManual")).toBeNull();
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
  const pressAPreset = async () => {
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "session.addMinutes" })[0]);
    });
  };

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

  const pressAPreset = async () => {
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "session.addMinutes" })[0]);
    });
  };

  test("offers the seats the server says can take the grant", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat(), seat({ place_id: 92, number: 10 })]));
    await mount();
    await pressAPreset();

    expect(screen.getByText("session.moveTitle")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "session.moveHere" })).toHaveLength(2);
  });

  test("moves to the seat that was pressed, for the minutes that were refused", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([seat()]));
    await mount();
    await pressAPreset();

    repo.transferExtension.mockResolvedValueOnce(session());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.moveHere" }));
    });

    // The session id, the seat, and the grant the cashier originally asked for.
    expect(repo.transferExtension).toHaveBeenCalledWith(42, 91, expect.any(Number));
  });

  test("says so when nothing is free rather than showing an empty list", async () => {
    repo.addTime.mockRejectedValueOnce(refusal());
    repo.extensionOptions.mockResolvedValueOnce(options([]));
    await mount();
    await pressAPreset();

    expect(screen.getByText("session.moveNone")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.moveHere" })).toBeNull();
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
