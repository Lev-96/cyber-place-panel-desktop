// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { IJoystickRule, IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import { SessionChangedEvent } from "@/realtime/useSessionChanged";
import SessionsBoard from "./SessionsBoard";

/**
 * A seat whose paid period runs out ends on the server, and the cashier has to
 * be told — that is money somebody now has to go and collect.
 *
 * The trigger is the event the board is ALREADY subscribed to. `kind` is
 * `stopped` for an auto-ending as much as for a manual one; what separates them
 * is `status`, which is `expired` when the clock ended it and `stopped` when a
 * person did. Only the first opens a receipt: a modal appearing on every desk
 * each time a colleague presses Stop would be noise.
 */

const repo = vi.hoisted(() => ({
  listPcs: vi.fn(), listActive: vi.fn(), preview: vi.fn(),
  addJoystick: vi.fn(), removeJoystick: vi.fn(),
}));
// The app-wide toaster, captured so a test can read what a press announced.
const toast = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toast.message(...a) } }));

// The board's `useSessionChanged` handler, captured so a test can fire an event
// at it the way Reverb would.
const realtime = vi.hoisted(() => ({ handler: null as null | ((e: SessionChangedEvent) => void) }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    preview: (...a: unknown[]) => repo.preview(...a),
    addJoystick: (...a: unknown[]) => repo.addJoystick(...a),
    removeJoystick: (...a: unknown[]) => repo.removeJoystick(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({
  useSessionChanged: (_branchId: unknown, onChange: (e: SessionChangedEvent) => void) => {
    realtime.handler = onChange;
  },
}));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/repositories/JoystickPriceRepository", () => ({
  joystickPriceRepository: { listByBranch: () => Promise.resolve([]) },
}));
// The management dialog a tile can open reads the venue's billing policy, and
// without this stub that read left the process as a REAL request to the staging
// backend — which answered 401 and surfaced as an unhandled rejection attributed
// to whichever test happened to be running. A unit test must not depend on a
// server being reachable, so the policy is answered here.
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: {
    get: () => Promise.resolve({
      branch_id: 7,
      money_rounding_step: 0,
      money_rounding_mode: "up",
      joystick_price: 500,
      joystick_included: 2,
      joystick_charged_slots: null,
      joystick_pricing_mode: "fixed",
    }),
  },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    // Echoes the key, EXCEPT for the one string that carries a placeholder:
    // the pad line interpolates the slot numbers into it, and a mock that
    // returned the bare key would swallow exactly the part under test.
    t: (k: string) => (k === "session.joystickSlot" ? "Joystick #{0}" : k),
    // HONOURS the precision options it is handed. It used to drop them, which
    // made every figure look identical to this suite whether the component
    // asked for cents or not — so a pad line rounding to whole units under a
    // total that printed cents was invisible here. A mock that discards the
    // argument under test proves nothing about it.
    money: (n: number, opts?: { maximumFractionDigits?: number }) =>
      opts?.maximumFractionDigits === 2 ? String(Number(n.toFixed(2))) : String(Math.round(n)),
    lang: "en",
  }),
}));

const device: IPcApi = {
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "PS4-08",
  kind: PC_KIND.Ps,
  status: PC_STATUS.InSession,
  place: { id: 10, number: 8, name: "PS4-08", type: "standard", platform: "ps5" },
};

/** A ten-minute tariff, still on the board when the event lands. */
const running = {
  id: 42,
  branch_id: 7,
  pc_id: 1,
  pc_label: "PS4-08",
  mode: "fixed",
  status: "active",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ends_at: new Date().toISOString(),
  hourly_rate: null,
  committed_amount: 250,
  total_paid: 250,
  is_free: false,
} as ISessionApi;

const event = (over: Partial<SessionChangedEvent> = {}): SessionChangedEvent => ({
  kind: "stopped",
  session_id: 42,
  branch_id: 7,
  pc_id: 1,
  place_id: 10,
  status: "expired",
  mode: "fixed",
  is_free: false,
  is_unlimited: false,
  joystick_count: 1,
  ends_at: null,
  at: new Date().toISOString(),
  ...over,
});

const mount = async () => {
  // Returned so a test can read the rendered tree itself — asserting that
  // something is NOT on screen (an emoji, a count) needs the container, not a
  // query that would pass simply by finding nothing.
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      // The management dialog a tile opens asks before lifting a ceiling, and
      // in the app that provider comes from App.tsx above the whole shell.
      <ConfirmProvider>
        <MemoryRouter>
          <SessionsBoard branchId={7} />
        </MemoryRouter>
      </ConfirmProvider>,
    );
  });
  return result;
};

const fire = async (e: SessionChangedEvent) => {
  await act(async () => {
    realtime.handler?.(e);
  });
};

describe("a seat that ends on its own clock", () => {
  beforeEach(() => {
    realtime.handler = null;
    repo.listPcs.mockResolvedValue([device]);
    repo.listActive.mockResolvedValue([running]);
    repo.preview.mockResolvedValue({
      mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 10,
      time_cost: 250, hourly_rate: 1500, package_name: "10m", items: [], items_total: 0,
      joysticks: [], joysticks_total: 0, subtotal: 250, gross_total: 250, total: 250,
    });
  });
  afterEach(cleanup);

  test("opens the receipt with what is owed", async () => {
    await mount();
    // Nothing on screen yet — the seat is still running.
    expect(screen.queryByText("session.checkoutDone")).toBeNull();

    await fire(event());

    // The bill the player now has to settle, and no offer to stop a seat that
    // has already stopped.
    expect(screen.getByText("session.checkoutDone")).toBeTruthy();
    expect(screen.getByText("session.totalDue")).toBeTruthy();
    expect(screen.queryByText("session.confirmStop")).toBeNull();
  });

  test("a colleague pressing Stop opens nothing", async () => {
    await mount();

    // Same event kind, and the status is what tells them apart.
    await fire(event({ status: "stopped" }));

    expect(screen.queryByText("session.checkoutDone")).toBeNull();
  });

  test("the other terms changing opens nothing", async () => {
    await mount();

    await fire(event({ kind: "time.added", status: "active" }));
    await fire(event({ kind: "free.changed", status: "active" }));

    expect(screen.queryByText("session.checkoutDone")).toBeNull();
  });

  test("an unknown seat is not invented a receipt for", async () => {
    await mount();

    // A branch this desk is not showing — nothing to price, so nothing opens.
    await fire(event({ session_id: 999 }));

    expect(screen.queryByText("session.checkoutDone")).toBeNull();
  });
});

/**
 * The same management dialog, reached from the card.
 *
 * "Options" already opened it, and that is not what somebody with eight
 * minutes left is scanning a tile for. The named button is a second way in to
 * ONE surface — not a second implementation of it.
 */
describe("adding time from the card", () => {
  beforeEach(() => {
    repo.listPcs.mockResolvedValue([device]);
    repo.listActive.mockResolvedValue([running]);
  });
  afterEach(cleanup);

  test("is offered on a seat that has an end", async () => {
    await mount();

    expect(screen.getByRole("button", { name: "session.addTime" })).toBeTruthy();
  });

  /**
   * A planned hourly start (2026-10-25): an end and a rate, no package. It
   * gets "+ Время" like any seat with an end, and its tariff line names the
   * rate and the plan — the server's figures — instead of an empty package.
   */
  test("a planned hourly start offers it and says its rate and plan", async () => {
    repo.listActive.mockResolvedValue([{
      ...running, hourly_rate: 1000, committed_amount: 3000, package_name: undefined,
      ends_at: new Date(Date.now() + 170 * 60_000).toISOString(),
    } as ISessionApi]);
    await mount();

    expect(screen.getByRole("button", { name: "session.addTime" })).toBeTruthy();
    const line = document.querySelector(".until")?.textContent ?? "";
    expect(line).toContain("1000 / time.hourShort");
    expect(line).toContain("session.planLine");
  });

  test("a count-up start (no length) offers no extra time, as before", async () => {
    repo.listActive.mockResolvedValue([{
      ...running, mode: "open", ends_at: null, is_unlimited: true, hourly_rate: 1000, committed_amount: null,
    } as ISessionApi]);
    await mount();

    expect(screen.queryByRole("button", { name: "session.addTime" })).toBeNull();
  });

  test("opens the management dialog", async () => {
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.addTime" }));
    });

    // The same dialog "Options" opens — asserted by its own heading, so a
    // second modal built for the card would fail this.
    expect(screen.getByText("session.options")).toBeTruthy();
  });

  /**
   * ⚠️ The button went; the dialog behind it did not.
   *
   * Add Time is what opens `SessionOptionsDialog`, and everything the dialog
   * has ever done is still in it — the presets, the manual grant, the
   * unlimited switch, and the whole booking-conflict and seat-migration flow.
   * A test that only checked the button was gone would pass just as happily
   * if somebody had deleted the dialog with it.
   */
  test("Add Time still opens the very dialog Options used to", async () => {
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.addTime" }));
    });

    // Its own heading, so a second modal built for the tile would fail this.
    expect(screen.getByText("session.options")).toBeTruthy();
  });

  test("is not offered on a seat with no end to extend", async () => {
    repo.listActive.mockResolvedValue([{ ...running, ends_at: null, is_unlimited: true }]);
    await mount();

    expect(screen.queryByRole("button", { name: "session.addTime" })).toBeNull();
    // ⚠️ And neither is "Options", on ANY tile.
    //
    // The reason this test used to give for keeping it — "a count-up session
    // has pads and a bill to waive" — stopped being true when pads moved onto
    // the tile and waiving became a decision made at the start. For an
    // unlimited session the dialog now holds two "not applicable" notices and
    // no action, and for every other session it is the same dialog the Add
    // Time button opens. Nothing behind it was removed: see
    // `SessionOptionsDialog`, still whole, still reached from Add Time.
    expect(screen.queryByRole("button", { name: "session.optionsShort" })).toBeNull();
  });
});

/**
 * Pads, managed from the tile.
 *
 * They were reachable only through the options dialog, which is two clicks and
 * a modal for the thing a cashier does most on a console: hand somebody a
 * second controller. The dialog is still there — this is a second door to the
 * same endpoints, not a second implementation.
 *
 * Whether a seat HAS pads is the backend's answer (`supports_joysticks`,
 * resolved from the place's platform) and never the label: "PS4-08" is a name
 * somebody typed, and a venue that renames a seat would lose its controls.
 */
describe("joysticks on the tile", () => {
  /**
   * The venue's rule, as the server sends it with every session.
   *
   * The fixture default is the ordinary club: two controllers in the kit, and
   * an extra one at 500 whether it is the third or the fourth. Tests that are
   * about a different venue say so with `withRule`.
   */
  const RULE: IJoystickRule = {
    included: 2,
    price: 500,
    price_4: null,
    max: 4,
    max_slot: 4,
    charged_slots: [3, 4],
    hourly: false,
    shared: true,
    // The kit is NOT here, and that is the contract: the server offers only
    // the pads a cashier hands over, which never includes the two the seat
    // came with.
    options: [
      { slot: 3, price: 500, shared: true },
      { slot: 4, price: 500, shared: true },
    ],
  };

  const withRule = (session: ISessionApi, over: Partial<IJoystickRule>): ISessionApi =>
    ({ ...session, joystick_rule: { ...RULE, ...over } } as ISessionApi);

  const ps = { ...running, supports_joysticks: true, joystick_count: 2, joystick_rule: RULE,
    joysticks: [{ id: 5, slot: 2, price: 500, started_at: new Date().toISOString(), stopped_at: null }] } as ISessionApi;

  beforeEach(() => {
    // RESET, not just re-stub. A select can make several calls for one change,
    // so "called twice" and "not called at all" are assertions here — and both
    // are meaningless if the previous test's calls are still counted. The
    // stepper-era version of this block only ever asserted "called with", which
    // is why it never needed this.
    repo.addJoystick.mockReset();
    repo.removeJoystick.mockReset();
    toast.message.mockReset();
    repo.listPcs.mockResolvedValue([device]);
    repo.addJoystick.mockResolvedValue(ps);
    repo.removeJoystick.mockResolvedValue(ps);
  });
  afterEach(cleanup);

  /**
   * The control names WHICH pad, and it starts on nothing.
   *
   * It was a select of target COUNTS and the board looped: "make it four" from
   * two made two calls and the server chose both slots. That could not survive
   * a venue handing out three controllers, or pricing the fourth apart from the
   * third, because the same "4" then meant a different amount of money at two
   * branches and the card had no way to know which.
   *
   * So the menu is the venue's own list, priced, and nothing is selected when
   * the tile opens: a control that starts on a value is one mis-scroll away
   * from charging a player for a controller nobody handed over.
   */
  // The extra pad is ONE "+🎮" switch now (PadToggle, 2026-10-25), as on the
  // floor's own screen. "+🎮" offers the pad the venue hands out NEXT, priced;
  // the lit switch takes the last one back. These read it as the menu
  // assertions used to read the select: which pad comes next, at what price,
  // and what cannot be had.
  const pads = () => screen.getByTestId("pad-toggle");
  const padButtons = () => [...pads().querySelectorAll("button")] as HTMLButtonElement[];
  const addBtn = () => screen.queryByTestId("pad-add") as HTMLButtonElement | null;
  const onSwitch = () => screen.queryByTestId("pad-remove") as HTMLButtonElement | null;
  /** The pad a press of the unlit button actually asks the server for. */
  const pressedSlot = async (): Promise<number | undefined> => {
    repo.addJoystick.mockClear();
    await act(async () => { fireEvent.click(screen.getByTestId("pad-add")); });
    return repo.addJoystick.mock.calls[0]?.[1] as number | undefined;
  };
  /** Presses "+🎮", which hands over whichever pad the venue gives next. */
  const pickPad = async (_slot: number) => {
    await act(async () => {
      fireEvent.click(screen.getByTestId("pad-add"));
    });
  };
  /** Taking the last pad back: the lit switch. */
  const takeBack = async () => {
    await act(async () => {
      fireEvent.click(screen.getByLabelText("session.padRemove"));
    });
  };

  /**
   * A fresh PlayStation seat is holding TWO controllers, and "+🎮" offers the
   * venue's product rather than one of them.
   *
   * The three symptoms this pins had one cause: the second controller was
   * modelled as an addable pad. The tile read "1 / 4" because the count was
   * "1 + rows", the control offered "the 2nd joystick, free" because slot 2 was
   * an option, and the venue's own "3/4" sat unreachable behind it.
   */
  test("a fresh seat holds two and offers the venue's pad, not one of its own", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();

    // The count.
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("1 / 4")).toBeNull();
    expect(screen.queryByText("2 / 3/4")).toBeNull();

    // The joystick button is pressable and hands over the venue's third pad,
    // not the kit's second. Nothing priced is printed on the card (2026-10-25).
    expect(addBtn()?.disabled).toBe(false);
    expect(onSwitch()).toBeNull();
    expect(pads().textContent).toBe("");
    expect(await pressedSlot()).toBe(3);
  });

  /**
   * The switch is the FIRST cell of the card's action grid, an ordinary card
   * action, and the pad line above carries no icon of its own (2026-10-25).
   */
  test("the joystick is the first card action and the pad line has no icon", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();

    const grid = pads().parentElement;
    expect(grid?.classList.contains("session-card__actions")).toBe(true);
    expect(grid?.firstElementChild).toBe(pads());
    expect(addBtn()?.className).toContain("session-card__btn");
    const card = grid?.closest(".session-card");
    const loose = [...(card?.querySelectorAll("svg") ?? [])].filter((x) => !x.closest("button"));
    expect(loose).toHaveLength(0);
  });

  // Nothing is handed over until "+🎮" is pressed, and opening the tile
  // presses nothing.
  test("opening the tile hands over nothing", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();

    expect(repo.addJoystick).not.toHaveBeenCalled();
  });

  /**
   * "+🎮" says the price of the pad that comes NEXT. A fourth controller with
   * no third one is not a thing a floor does, and offering it would charge the
   * fourth pad's fee for the third pad's use; the server refuses it too.
   */
  test("offers the pad the VENUE hands out next, at its own price", async () => {
    // Two priced apart: the third at 500, the fourth at 700.
    repo.listActive.mockResolvedValue([withRule(ps, {
      shared: false,
      options: [
        { slot: 3, price: 500, shared: false },
        { slot: 4, price: 700, shared: false },
      ],
    })]);
    await mount();

    expect(await pressedSlot()).toBe(3);
  });

  /** One shared figure is quoted ONCE. */
  test("a venue on one figure quotes it once", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();

    expect(padButtons()).toHaveLength(1);
  });

  /**
   * With the third pad out the switch is lit and takes it back, and "+🎮"
   * moves on to the fourth at its own price — a venue that hands out a fourth
   * controller keeps it.
   */
  test("a pad in play lights the switch and +🎮 offers the next one", async () => {
    repo.listActive.mockResolvedValue([withRule({
      ...ps,
      joystick_count: 3,
      joysticks: [{ id: 6, slot: 3, price: 500, is_charged: true, is_hourly: false,
        started_at: new Date().toISOString(), stopped_at: null }],
    } as unknown as ISessionApi, {
      shared: false,
      options: [
        { slot: 3, price: 500, shared: false },
        { slot: 4, price: 700, shared: false },
      ],
    })]);
    await mount();

    expect(onSwitch()?.getAttribute("aria-pressed")).toBe("true");
    expect(onSwitch()?.textContent).toBe("");
    expect(padButtons()).toHaveLength(2);
    expect(await pressedSlot()).toBe(4);
  });

  /**
   * A venue that hands out three controllers has nothing after the third: the
   * lit switch is the whole control, exactly the floor's on/off button.
   */
  test("at the venue's ceiling the switch is the only control", async () => {
    repo.listActive.mockResolvedValue([withRule({
      ...ps,
      joystick_count: 3,
      joysticks: [{ id: 6, slot: 3, price: 500, is_charged: true, is_hourly: false,
        started_at: new Date().toISOString(), stopped_at: null }],
    } as unknown as ISessionApi, {
      max_slot: 3,
      shared: false,
      options: [{ slot: 3, price: 500, shared: false }],
    })]);
    await mount();

    expect(onSwitch()).toBeTruthy();
    expect(addBtn()).toBeNull();
  });

  /** Handing it back puts "+🎮" straight back on that pad. */
  test("a pad handed back is offered again", async () => {
    repo.listActive.mockResolvedValue([withRule({
      ...ps,
      joystick_count: 2,
      joysticks: [{ id: 6, slot: 3, price: 500, is_charged: true, is_hourly: false,
        started_at: "2026-09-10T14:00:00Z", stopped_at: "2026-09-10T14:20:00Z" }],
    } as unknown as ISessionApi, {
      shared: false,
      options: [
        { slot: 3, price: 500, shared: false },
        { slot: 4, price: 700, shared: false },
      ],
    })]);
    await mount();

    expect(onSwitch()).toBeNull();
    expect(addBtn()?.disabled).toBe(false);
    expect(await pressedSlot()).toBe(3);
  });

  test("the tile shows the pads the seat is holding, not a fraction", async () => {
    repo.listActive.mockResolvedValue([{ ...ps, joystick_count: 3 } as ISessionApi]);
    await mount();

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.queryByText("3 / 4")).toBeNull();
  });

  /**
   * A seat that is not a PlayStation says nothing about pads at all.
   *
   * The regression this pins was found by driving the real panel: a poker table
   * announced "2 joysticks" it does not have, because the tile inferred "has
   * pads" from a count above one — a heuristic that was true of every seat the
   * moment a fresh PlayStation started counting its base kit of two.
   */
  test("a seat that is not a PlayStation shows no pad count at all", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      supports_joysticks: false,
      supports_chips: true,
      joystick_count: 2,
      joysticks: [],
      joystick_rule: undefined,
    } as unknown as ISessionApi]);
    await mount();

    expect(screen.queryByLabelText("session.joysticks")).toBeNull();
    const padLine = [...document.querySelectorAll("span[title]")]
      .find((el) => (el.getAttribute("title") ?? "").startsWith("session.joysticks"));
    expect(padLine).toBeUndefined();
  });

  /**
   * …and a WAIVED seat that is not a PlayStation still says it is waived while
   * saying nothing about pads.
   *
   * The two facts share a row, so one gate cannot serve both: the free marker
   * belongs to every seat and the pad count belongs to PlayStations. Written as
   * its own case because it is the only one that can tell the two gates apart.
   */
  test("a waived poker table shows it is free and still no pad count", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      supports_joysticks: false,
      supports_chips: true,
      is_free: true,
      joystick_count: 2,
      joysticks: [],
      joystick_rule: undefined,
    } as unknown as ISessionApi]);
    await mount();

    const padLine = [...document.querySelectorAll("span[title]")]
      .find((el) => (el.getAttribute("title") ?? "").startsWith("session.joysticks"));
    expect(padLine).toBeUndefined();
    expect(screen.queryByLabelText("session.joysticks")).toBeNull();
  });

  test("is absent on a seat that has none", async () => {
    repo.listActive.mockResolvedValue([
      { ...running, supports_joysticks: false, joystick_count: 1, joysticks: [] } as ISessionApi,
    ]);
    await mount();

    expect(screen.queryByLabelText("session.joysticks")).toBeNull();
  });

  /** One press is ONE pad, and the server is told which. */
  test("choosing a pad hands over exactly that pad", async () => {
    repo.listActive.mockResolvedValue([ps]);
    await mount();
    await pickPad(3);

    expect(repo.addJoystick).toHaveBeenCalledTimes(1);
    expect(repo.addJoystick).toHaveBeenCalledWith(42, 3);
    expect(repo.removeJoystick).not.toHaveBeenCalled();
  });

  // A double press is one pad: the first press disables every button until
  // the server answers, and a press on a disabled button does nothing.
  test("a second press while the first is in flight hands over nothing", async () => {
    repo.listActive.mockResolvedValue([ps]);
    let release!: (s: ISessionApi) => void;
    repo.addJoystick.mockReturnValueOnce(new Promise((r) => { release = r; }));
    await mount();

    await pickPad(3);
    await pickPad(3);

    expect(repo.addJoystick).toHaveBeenCalledTimes(1);
    await act(async () => { release(ps); });
  });

  test("taking one back names the highest pad in play", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      joystick_count: 3,
      joysticks: [
        { id: 5, slot: 2, price: 500, started_at: "2026-09-10T14:00:00Z", stopped_at: null },
        { id: 6, slot: 3, price: 500, started_at: "2026-09-10T14:00:00Z", stopped_at: null },
      ],
    } as ISessionApi]);
    await mount();
    await takeBack();

    expect(repo.removeJoystick).toHaveBeenCalledTimes(1);
    expect(repo.removeJoystick).toHaveBeenCalledWith(42, 3);
  });

  /**
   * No EXTRA in play, nothing to take back: the control is not there at all.
   *
   * The floor is the kit, not one. A seat holding exactly the two controllers
   * it came with has nothing a cashier can hand back, and a "−" beside it
   * offers an operation the server refuses.
   */
  test("a seat holding only the kit offers nothing to take back", async () => {
    repo.listActive.mockResolvedValue([
      { ...ps, joystick_count: 2, joysticks: [] } as ISessionApi,
    ]);
    await mount();

    expect(screen.queryByLabelText("session.padRemove")).toBeNull();
  });

  /** …and one extra out is exactly when it appears. */
  test("a seat holding an extra can hand it back", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      joystick_count: 3,
      joysticks: [{ id: 6, slot: 3, price: 500, is_charged: true,
        started_at: new Date().toISOString(), stopped_at: null }],
    } as unknown as ISessionApi]);
    await mount();

    expect(screen.getByLabelText("session.padRemove")).toBeTruthy();
  });

  /**
   * A payload from a backend that predates the count still reads as a seat
   * holding its kit, never as one holding a single controller.
   */
  test("a session that reports no count is still holding its kit", async () => {
    const { joystick_count: _omitted, ...withoutCount } = ps as ISessionApi & { joystick_count?: number };
    repo.listActive.mockResolvedValue([withoutCount as ISessionApi]);
    await mount();

    // Asserted on the joystick line itself, not on the document: a bare "1"
    // matches the board's own section counter, which would let this pass while
    // the tile said one controller.
    const line = [...document.querySelectorAll("span[title]")]
      .find((el) => (el.getAttribute("title") ?? "").startsWith("session.joysticks"));
    expect(line?.textContent).toContain("2");
    expect(line?.textContent).not.toContain("1");
  });

  test("is held while a change is in flight", async () => {
    repo.listActive.mockResolvedValue([ps]);
    let release!: (s: ISessionApi) => void;
    repo.addJoystick.mockReturnValueOnce(new Promise((r) => { release = r; }));
    await mount();

    await pickPad(3);
    expect(padButtons().every((b) => b.disabled)).toBe(true);

    await act(async () => { release(ps); });
  });

  describe("what a change announces", () => {
    test("an add is announced green, with the count the server returned", async () => {
      repo.listActive.mockResolvedValue([ps]);
      repo.addJoystick.mockResolvedValue({ ...ps, joystick_count: 3 } as ISessionApi);
      await mount();
      await pickPad(3);

      expect(toast.message).toHaveBeenCalledWith("success", expect.stringContaining("3 / 4"));
    });

    test("a removal is announced red", async () => {
      // A seat with an extra actually out, or there is nothing to take back
      // and the control is not drawn at all.
      repo.listActive.mockResolvedValue([{
        ...ps,
        joystick_count: 3,
        joysticks: [{ id: 6, slot: 3, price: 500, is_charged: true,
          started_at: new Date().toISOString(), stopped_at: null }],
      } as unknown as ISessionApi]);
      repo.removeJoystick.mockResolvedValue({ ...ps, joystick_count: 2 } as ISessionApi);
      await mount();
      await takeBack();

      expect(toast.message).toHaveBeenCalledWith("error", expect.stringContaining("2 / 4"));
    });

    test("a refusal announces nothing", async () => {
      repo.listActive.mockResolvedValue([ps]);
      repo.addJoystick.mockRejectedValueOnce(new Error("No price is set"));
      await mount();
      await pickPad(3);

      expect(toast.message).not.toHaveBeenCalled();
    });
  });


  /**
   * The tile has ONE rounding rule, the same as the total ticking above it.
   *
   * Under the hourly strategy a pad's earnings are a fraction as a matter of
   * course, and the pad line used to round to whole units while the running
   * total printed cents — two figures on one 160px card that do not add up.
   */
  test("a fractional pad total prints cents, like the total above it", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      hourly_rate: 1000,
      joystick_count: 3,
      joysticks: [{
        id: 2, slot: 3, price: 50, is_charged: true, is_hourly: true,
        started_at: new Date(Date.now() - 80_000).toISOString(), stopped_at: null,
      }],
    } as unknown as ISessionApi]);
    await mount();

    // 50/h for 80 seconds is about 1.11, and the line has to say so rather
    // than rounding it to a whole unit. The pad line is the identity plus the
    // figure, so that is what finds it.
    const padLine = [...document.querySelectorAll("span")]
      .find((el) => el.children.length === 0 && /^[\d/,\s]+ · /.test(el.textContent ?? ""));
    expect(padLine?.textContent).toMatch(/1\.1/);
  });

  describe("the pad charge on the tile", () => {
    const priced = (n: number, price = 300, chargedAll = true) => ({
      ...ps,
      joystick_count: 1 + n,
      joysticks: Array.from({ length: n }, (_, i) => ({
        id: i + 1, slot: i + 2, price, is_charged: chargedAll,
        started_at: "2026-09-10T14:00:00Z", stopped_at: null,
      })),
    } as ISessionApi);

    /**
     * Identity and figure, on ONE line.
     *
     * It was this line plus a second one — "Joystick #2, 3 · 300 = 600" — and
     * on a 160px card two lines about the same pads is most of the card. The
     * slot numbers are printed here anyway, the unit price is on the menu that
     * hands the pad over, and the multiplication is what made the old wording
     * read as nonsense beside numbers that are identities.
     */
    test("says which pads are out and what they have earned, on one line", async () => {
      repo.listActive.mockResolvedValue([priced(2)]);
      await mount();

      // The line lands as two text nodes (identity, then the figure), so
      // `getByText` cannot see it whole — the question is what the cashier
      // reads, which is the element's own text content.
      const padLine = [...document.querySelectorAll("span")].find((el) =>
        el.children.length === 0 && /^[\d/,\s]+ · /.test(el.textContent ?? ""));
      expect(padLine?.textContent).toMatch(/600/);
      // No second line naming them again, and no multiplication.
      expect(screen.queryByText(/Joystick #/)).toBeNull();
      expect(screen.queryByText(/2 × /)).toBeNull();
    });

    test("a pad handed back is still counted and still charged", async () => {
      repo.listActive.mockResolvedValue([{
        ...ps,
        joystick_count: 2,
        joysticks: [{
          id: 1, slot: 3, price: 300, is_charged: true,
          started_at: "2026-09-10T14:00:00Z", stopped_at: "2026-09-10T14:05:00Z",
        }],
      } as ISessionApi]);
      await mount();

      // One pad on the bill, no extras in play: the seat is back to the two it
      // came with, and the charge still stands beside them — on the same line,
      // which is the whole of what the card says about pads now.
      expect(screen.getByText(/^2 · .*300/)).toBeTruthy();
    });

    test("a seat with no pads says nothing about them", async () => {
      repo.listActive.mockResolvedValue([{ ...ps, joystick_count: 1, joysticks: [] }]);
      const { container } = await mount();

      expect(container.textContent).not.toContain("session.joysticksCost");
    });

    test("a waived seat quotes no fee", async () => {
      repo.listActive.mockResolvedValue([{ ...priced(2), is_free: true } as ISessionApi]);
      const { container } = await mount();

      // The pads are still NAMED; the money is not printed under a bill
      // nobody is paying. This venue prices the pair as one figure, so the pad
      // in play is "3/4" rather than the position it happened to open.
      expect(screen.getByText("3/4")).toBeTruthy();
      expect(container.textContent).not.toContain("session.joysticksCost");
    });

    test("periods frozen at different fees show the sum and no multiplication", async () => {
      repo.listActive.mockResolvedValue([{
        ...ps,
        joystick_count: 3,
        joysticks: [
          { id: 1, slot: 2, price: 300, is_charged: true, started_at: "2026-09-10T14:00:00Z", stopped_at: null },
          { id: 2, slot: 3, price: 500, is_charged: true, started_at: "2026-09-10T15:00:00Z", stopped_at: null },
        ],
      } as ISessionApi]);
      const { container } = await mount();

      // "2 × ?" would be a lie across a re-pricing; the sum is always true.
      expect(container.textContent).toContain("800");
      expect(container.textContent).not.toContain("×");
    });
  });



  /**
   * At either end the button is GONE, not greyed out.
   *
   * On a 22px control a disabled state is a shade of grey an operator has to
   * compare against its neighbour to read, and "why can I not press this" is a
   * worse question than "there is nothing to press". The count beside it — 1/4
   * or 4/4 — is what answers the question a missing button raises.
   */


  /** Both ends move with the count, on the same board. */


  /**
   * The count on the tile is the SERVER's, never inferred from the rows the
   * payload happens to carry.
   *
   * A board that counted `joysticks.length` would disagree with the server the
   * moment a period closed — the rows stay on the payload, closed ones
   * included, because a bill is made of them.
   */
  test("the count comes from the server, not from counting the rows", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      joystick_count: 2,
      joysticks: [
        { id: 5, slot: 2, price: 500, started_at: "2026-09-09T14:00:00Z", stopped_at: "2026-09-09T14:20:00Z" },
        { id: 6, slot: 3, price: 700, started_at: "2026-09-09T15:00:00Z", stopped_at: null },
      ],
    }]);
    await mount();

    // Two rows, one of them closed. The closed one is not in play, so the seat
    // is holding its kit plus the third pad — and this venue prices the pair as
    // one figure, so that pad is named "3/4".
    expect(screen.getByText("3/4")).toBeTruthy();
  });

  /**
   * Removal names the highest OPEN slot, so the pad a "−" takes back is the
   * last one handed out and never one that has already come back.
   */

  test("shows a refusal on the tile it came from", async () => {
    repo.listActive.mockResolvedValue([ps]);
    repo.addJoystick.mockRejectedValue(new Error("No price is set for joystick #3"));
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByTestId("pad-add"));
    });

    // Word for word: "no price is set for that slot" is a sentence the cashier
    // has to act on, and a generic failure line would send them looking.
    expect(screen.getByText("No price is set for joystick #3")).toBeTruthy();
  });

  // ── what the tile says under each pricing model ───────────────────────

  test("an hourly pad puts the live rate on the tile and marks the line as a rate", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      hourly_rate: 1000,
      joystick_count: 3,
      joysticks: [
        { id: 2, slot: 3, price: 500, is_charged: true, is_hourly: true,
          started_at: new Date(Date.now() - 3600_000).toISOString(), stopped_at: null },
      ],
    } as unknown as ISessionApi]);
    await mount();

    // The seat plus the pad currently out. `t()` is mocked to return the key,
    // so the assertion is on the key rather than on translated copy.
    expect(screen.getByText(/session\.currentRate/)).toBeTruthy();
    // And the pad line does NOT repeat it. The tile names the controller and
    // what it has earned so far; the rate is one line above and saying it
    // twice is most of a 160px card.
    //
    // The unit price and its per-hour suffix still exist where a unit price is
    // the point — the receipt and the history — and are pinned there.
    const padLine = [...document.querySelectorAll("span")].find((el) =>
      el.children.length === 0 && /^[\d/,\s]+ · /.test(el.textContent ?? ""));
    expect(padLine, "the pad line is missing").toBeTruthy();
    expect(padLine?.textContent).not.toContain("session.perHourShort");
    // …and it is the EARNED figure, not the rate: an hour of a 500/h pad.
    expect(padLine?.textContent).toMatch(/500/);
  });

  // A session CAN hold both: the venue switched strategy while the seat ran,
  // and each pad kept the model it was handed out under. The pad line quotes a
  // unit price for the whole group, so it may only call that price a rate when
  // every charged row actually is one — otherwise the line would put "/h" on a
  // fee the player owes in full.
  test("a session holding both kinds does not call the unit price a rate", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      hourly_rate: 1000,
      joystick_count: 4,
      joysticks: [
        { id: 2, slot: 3, price: 500, is_charged: true, is_hourly: true,
          started_at: new Date(Date.now() - 3600_000).toISOString(), stopped_at: null },
        { id: 3, slot: 4, price: 500, is_charged: true, is_hourly: false,
          started_at: new Date(Date.now() - 3600_000).toISOString(), stopped_at: null },
      ],
    } as unknown as ISessionApi]);
    await mount();

    // The tile quotes no unit price at all now, so it cannot call a fee a
    // rate: what it shows is the identity and the money earned.
    const padLine = [...document.querySelectorAll("span")].find((el) =>
      el.children.length === 0 && /^[\d/,\s]+ · /.test(el.textContent ?? ""));
    expect(padLine, "the pad line is missing").toBeTruthy();
    expect(padLine?.textContent).not.toContain("session.perHourShort");
    // The hourly pad still moves the seat's rate, so that line stays.
    expect(screen.getByText(/session\.currentRate/)).toBeTruthy();
  });

  test("a flat fee shows no rate line, because the rate never moved", async () => {
    repo.listActive.mockResolvedValue([{
      ...ps,
      hourly_rate: 1000,
      joystick_count: 3,
      joysticks: [
        { id: 2, slot: 3, price: 500, is_charged: true, is_hourly: false,
          started_at: new Date(Date.now() - 3600_000).toISOString(), stopped_at: null },
      ],
    } as unknown as ISessionApi]);
    await mount();

    expect(screen.queryByText(/session\.currentRate/)).toBeNull();
  });
});

/**
 * A venue whose extra pads are one payment for the whole session.
 *
 * The tile is where a cashier meets it: the fee is taken on the first handout,
 * every controller after it goes out for nothing, and the card has to say WHY
 * it is offering something for nothing. A zero with no reason beside it is read
 * as a fault and phoned in as one.
 *
 * Whether the fee was taken is the SERVER's answer, on the session's rule.
 */
describe("a seat whose joystick fee is charged once", () => {
  const onceRule = {
    included: 2, price: 500, price_4: null, max: 4, max_slot: 4,
    charged_slots: [3, 4], hourly: false, shared: true,
    charge_once: true,
  };
  const seat = (over: Record<string, unknown>) => ({
    ...running,
    supports_joysticks: true,
    ...over,
  } as unknown as ISessionApi);

  beforeEach(() => {
    repo.listPcs.mockResolvedValue([device]);
  });
  afterEach(cleanup);

  test("says the fee was taken on the pad line, and offers to take it back", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 3,
      joysticks: [{
        id: 7, slot: 3, price: 500, is_charged: true, is_hourly: false,
        started_at: new Date(Date.now() - 60_000).toISOString(), stopped_at: null,
      }],
      joystick_rule: {
        ...onceRule,
        fee_taken: true,
        options: [{ slot: 4, price: 0, shared: true }],
      },
    })]);
    await mount();

    // On the pad line, so it is visible without pressing anything.
    //
    // Asserted on the LEAF that carries the words and nowhere else: every
    // ancestor inherits the text, so a looser query passes with this line
    // deleted — which is how the first version of this assertion proved
    // nothing.
    const onTheLine = [...document.querySelectorAll("span")]
      .filter((el) => el.children.length === 0
        && (el.textContent ?? "").includes("session.padFeeTaken"));
    expect(onTheLine.length).toBe(1);
    // A venue that charges once gets a switch, not a menu, and with the pad
    // out the switch offers the other direction.
    expect(screen.queryByLabelText("session.joysticks")).toBeNull();
    expect(screen.getByRole("button", { name: "session.padRemoveOne" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.padAddOne" })).toBeNull();
  });

  test("says nothing of the sort before the fee is taken", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 2,
      joysticks: [],
      joystick_rule: {
        ...onceRule,
        fee_taken: false,
        options: [{ slot: 3, price: 500, shared: true }, { slot: 4, price: 500, shared: true }],
      },
    })]);
    await mount();

    expect(screen.queryByText(/session\.padFeeTaken/)).toBeNull();
    // Nothing out yet, so the switch offers the pad rather than its return.
    expect(screen.getByRole("button", { name: "session.padAddOne" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.padRemoveOne" })).toBeNull();
  });

  /**
   * A venue that hands pads out free is a different thing, and the tile must
   * not tell a cashier that somebody has paid.
   */
  test("a free pad can still be handed over, with nothing priced on the card", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 2,
      joysticks: [],
      joystick_rule: {
        ...onceRule,
        charge_once: false,
        fee_taken: false,
        options: [{ slot: 3, price: 0, shared: true }, { slot: 4, price: 0, shared: true }],
      },
    })]);
    await mount();

    expect((screen.getByTestId("pad-add") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("pad-toggle").textContent).toBe("");
  });
});

/**
 * The switch a "one payment" venue gets instead of the pad menu.
 *
 * The venue sells its extras as one charge, so it sells ONE extra: the seat
 * either has the controller or it does not, and a menu of named slots asks a
 * question the venue did not ask. The control is a button that says what
 * pressing it will do.
 *
 * ## Why every assertion here reads the SERVER's answer
 *
 * The button holds no state of its own. Which way it points comes from the
 * session's own rows, so another cashier's press, a socket event or a poll
 * flips it without this component being told twice — which is what keeps two
 * screens on one seat from disagreeing, and what stops a press being counted
 * against a stale view.
 */
describe("the joystick switch on a venue that charges once", () => {
  const onceRule = {
    included: 2, price: 500, price_4: null, max: 4, max_slot: 4,
    charged_slots: [3, 4], hourly: false, shared: true, charge_once: true,
  };
  const pad = (over: Record<string, unknown> = {}) => ({
    id: 7, slot: 3, price: 500, is_charged: true, is_hourly: false,
    started_at: new Date(Date.now() - 60_000).toISOString(), stopped_at: null, ...over,
  });
  const seat = (over: Record<string, unknown>) =>
    ({ ...running, supports_joysticks: true, ...over } as unknown as ISessionApi);

  /** Nothing out: one entry left to give, the fee not yet taken. */
  const idle = seat({
    joystick_count: 2,
    joysticks: [],
    joystick_rule: {
      ...onceRule, fee_taken: false,
      options: [{ slot: 3, price: 500, shared: true }, { slot: 4, price: 500, shared: true }],
    },
  });
  /** One out: the fee taken, and the next entry priced at nothing. */
  const holding = seat({
    joystick_count: 3,
    joysticks: [pad()],
    joystick_rule: { ...onceRule, fee_taken: true, options: [{ slot: 4, price: 0, shared: true }] },
  });

  beforeEach(() => {
    realtime.handler = null;
    repo.addJoystick.mockReset();
    repo.removeJoystick.mockReset();
    repo.listPcs.mockResolvedValue([device]);
  });
  afterEach(cleanup);

  test("replaces the pad menu entirely", async () => {
    repo.listActive.mockResolvedValue([idle]);
    await mount();

    expect(screen.queryByLabelText("session.joysticks")).toBeNull();
    expect(screen.getByRole("button", { name: "session.padAddOne" })).toBeTruthy();
    // …and the separate "−" the menu needed is gone with it: one control, one
    // direction at a time.
    expect(screen.queryByRole("button", { name: "session.padRemove" })).toBeNull();
  });

  test("hands the venue's next pad over when pressed", async () => {
    repo.listActive.mockResolvedValue([idle]);
    repo.addJoystick.mockResolvedValue(holding);
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.padAddOne" }));
    });

    expect(repo.addJoystick).toHaveBeenCalledWith(running.id, 3);
    expect(repo.addJoystick).toHaveBeenCalledTimes(1);
  });

  test("and takes it back when pressed again", async () => {
    repo.listActive.mockResolvedValue([holding]);
    repo.removeJoystick.mockResolvedValue(idle);
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.padRemoveOne" }));
    });

    expect(repo.removeJoystick).toHaveBeenCalledWith(running.id, 3);
    expect(repo.addJoystick).not.toHaveBeenCalled();
  });

  /**
   * The rule the requirement is about: the same controller cannot go out
   * twice. With one out there is no "add" to press at all — and the server
   * refuses it as well, which is what makes this a rule rather than a hidden
   * button.
   */
  test("offers no way to hand out a second one while the first is out", async () => {
    repo.listActive.mockResolvedValue([holding]);
    await mount();

    expect(screen.queryByRole("button", { name: "session.padAddOne" })).toBeNull();
    expect(screen.getByRole("button", { name: "session.padRemoveOne" })).toBeTruthy();
  });

  /**
   * After the controller comes back, the switch offers it again.
   *
   * The seat still carries the returned period — it is what the receipt names
   * and what records that the fee was taken — so "is a pad out" has to read
   * only the OPEN ones. Counting the row itself would leave the button stuck
   * on "remove" with nothing to remove.
   */
  test("points back at 'add' once the pad has been handed back", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 2,
      joysticks: [pad({ stopped_at: new Date().toISOString() })],
      joystick_rule: {
        ...onceRule, fee_taken: true,
        // The fee is spent, so what is left costs nothing.
        options: [{ slot: 3, price: 0, shared: true }, { slot: 4, price: 0, shared: true }],
      },
    })]);
    await mount();

    expect(screen.getByRole("button", { name: "session.padAddOne" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.padRemoveOne" })).toBeNull();
  });

  /** …and pressing it hands one over again, for nothing. */
  test("and hands another over, which the venue does not charge for", async () => {
    const returned = seat({
      joystick_count: 2,
      joysticks: [pad({ stopped_at: new Date().toISOString() })],
      joystick_rule: {
        ...onceRule, fee_taken: true,
        options: [{ slot: 3, price: 0, shared: true }, { slot: 4, price: 0, shared: true }],
      },
    });
    repo.listActive.mockResolvedValue([returned]);
    repo.addJoystick.mockResolvedValue(holding);
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.padAddOne" }));
    });

    expect(repo.addJoystick).toHaveBeenCalledWith(running.id, 3);
  });

  /** A venue with nothing left to hand out says so, rather than hiding. */
  test("is disabled when the venue has no pad to give", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 2,
      joysticks: [],
      joystick_rule: { ...onceRule, fee_taken: false, options: [] },
    })]);
    await mount();

    const button = screen.getByRole("button", { name: "session.padAddOne" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  /**
   * A socket event turns the button around, because the button only ever
   * reflected the server's rows in the first place.
   */
  test("follows a change made on another screen", async () => {
    repo.listActive.mockResolvedValueOnce([idle]);
    await mount();
    expect(screen.getByRole("button", { name: "session.padAddOne" })).toBeTruthy();

    // The other cashier's handout arrives the way Reverb delivers it: an
    // event, then this board re-reading the seat from the server.
    repo.listActive.mockResolvedValue([holding]);
    await fire({
      kind: "joystick.added", session_id: running.id, branch_id: 7, pc_id: device.id,
      place_id: 10, status: "active", mode: "open", is_free: false, is_unlimited: false,
      joystick_count: 3, ends_at: null, at: new Date().toISOString(),
    } as SessionChangedEvent);

    expect(screen.getByRole("button", { name: "session.padRemoveOne" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.padAddOne" })).toBeNull();
    // Nothing was sent from this screen: it watched, it did not act.
    expect(repo.addJoystick).not.toHaveBeenCalled();
  });

  /** Every other venue keeps the menu it has, untouched. */
  test("a venue that charges per pad still gets the menu", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 2,
      joysticks: [],
      joystick_rule: {
        ...onceRule, charge_once: false, fee_taken: false,
        options: [{ slot: 3, price: 500, shared: true }, { slot: 4, price: 500, shared: true }],
      },
    })]);
    await mount();

    expect(screen.getByLabelText("session.joysticks")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.padAddOne" })).toBeNull();
  });

  /** …including one from a backend that never sends the field. */
  test("an older payload still gets the menu", async () => {
    repo.listActive.mockResolvedValue([seat({
      joystick_count: 2,
      joysticks: [],
      joystick_rule: {
        included: 2, price: 500, price_4: null, max: 4, max_slot: 4,
        charged_slots: [3, 4], hourly: false, shared: true,
        options: [{ slot: 3, price: 500, shared: true }, { slot: 4, price: 500, shared: true }],
      },
    })]);
    await mount();

    expect(screen.getByLabelText("session.joysticks")).toBeTruthy();
  });
});
