// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import type { IRelocationOptions } from "@/api/sessions";
import RelocateSessionDialog from "./RelocateSessionDialog";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * «Переместить игрока» as the cashier sees it.
 *
 * The backend tests prove the rules (money, locks, limits); this proves the
 * screen sends exactly what the operator chose and nothing it did not:
 *
 *  - no rate unless "Change price" was used — the server's own resolution is
 *    the default, never a figure the panel re-sends;
 *  - a limited seat is only sent with the limit the operator SAW and accepted,
 *    verbatim, so a limit that moved since is refused by the server;
 *  - a refusal redraws the list instead of leaving a stale choice armed.
 */

const repo = vi.hoisted(() => ({ relocationOptions: vi.fn(), relocate: vi.fn() }));
const toast = vi.hoisted(() => ({ message: vi.fn(), warning: vi.fn() }));
vi.mock("@/ui/notify", () => ({
  notify: {
    message: (...a: unknown[]) => toast.message(...a),
    warning: (...a: unknown[]) => toast.warning(...a),
  },
}));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    relocationOptions: (...a: unknown[]) => repo.relocationOptions(...a),
    relocate: (...a: unknown[]) => repo.relocate(...a),
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    // Echo the key, with its arguments where the copy interpolates them, so a
    // test can see the seat, the clock and the minutes actually arrive.
    t: (k: string) => (["session.relocateLimited", "session.relocateAcceptLimit", "session.relocatedToast", "session.moveTakenToast"].includes(k) ? `${k} {0} {1}` : k),
    money: (n: number) => String(n),
    lang: "en",
  }),
}));

const session = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 42, branch_id: 7, pc_id: 21, pc_label: "№1",
  started_at: "2026-09-25T10:00:00.000Z", ends_at: "2026-09-25T11:00:00.000Z",
  status: "active", total_paid: 0, is_free: false, is_unlimited: false,
  ...over,
} as ISessionApi);

const FREE_UNTIL = "2026-09-25T10:50:00+00:00";
const options = (): IRelocationOptions => ({
  current: { place_id: 1, number: 1, name: null, platform: "ps5", type: "standard", hourly_rate: 1500, ends_at: "2026-09-25T11:00:00+00:00", paused: false },
  places: [
    { place_id: 2, number: 2, name: null, platform: "ps5", type: "standard", hourly_rate: 1500, same_rate: true, free_until: null, free_minutes: null },
    { place_id: 3, number: 3, name: null, platform: "ps5", type: "vip", hourly_rate: 2000, same_rate: false, free_until: null, free_minutes: null },
    { place_id: 4, number: 4, name: null, platform: "ps5", type: "vip", hourly_rate: 2000, same_rate: false, free_until: FREE_UNTIL, free_minutes: 30 },
  ],
});

const onMoved = vi.fn();
const mount = async () => {
  await act(async () => {
    render(
      <ConfirmProvider>
        <RelocateSessionDialog session={session()} onClose={() => {}} onMoved={onMoved} />
      </ConfirmProvider>,
    );
  });
};

const seat = (n: number) => screen.getByText(`№${n}`, { selector: "strong" }).closest("button") as HTMLButtonElement;
const moveButton = () => screen.getByRole("button", { name: "session.relocateConfirm" }) as HTMLButtonElement;
const press = async (el: Element) => { await act(async () => { fireEvent.click(el); }); };

beforeEach(() => {
  Object.values(repo).forEach((fn) => fn.mockReset());
  toast.message.mockReset();
  toast.warning.mockReset();
  onMoved.mockReset();
  repo.relocationOptions.mockResolvedValue(options());
  repo.relocate.mockResolvedValue(session({ pc_id: 22 }));
});
afterEach(cleanup);

describe("the offer", () => {
  test("same-price seats come first, under their own heading, before the others", async () => {
    await mount();

    const text = document.body.textContent ?? "";
    expect(text.indexOf("session.relocateSameRate")).toBeLessThan(text.indexOf("session.relocateOtherRate"));
    expect(text.indexOf("№2")).toBeLessThan(text.indexOf("№3"));
    // Nothing is armed until a seat is chosen.
    expect(moveButton().disabled).toBe(true);
  });

  test("a limited seat says when it is booked and how long can be played", async () => {
    await mount();
    expect(seat(4).textContent).toContain("session.relocateLimited");
    expect(seat(4).textContent).toContain(" 30");
  });
});

describe("the move", () => {
  test("a plain move sends the seat and nothing else", async () => {
    await mount();
    await press(seat(2));
    await press(moveButton());

    expect(repo.relocate).toHaveBeenCalledWith(42, { place_id: 2 });
    expect(onMoved).toHaveBeenCalledWith(expect.objectContaining({ pc_id: 22 }), { pcId: 21 });
    expect(toast.message).toHaveBeenCalledWith("success", expect.stringContaining("№2"));
  });

  test("a price set by hand is sent, and an invalid one arms nothing", async () => {
    await mount();
    await press(seat(3));
    await press(screen.getByText("session.relocateChangePrice"));

    const box = screen.getByRole("textbox");
    await act(async () => { fireEvent.change(box, { target: { value: "0" } }); });
    expect(moveButton().disabled).toBe(true);

    await act(async () => { fireEvent.change(box, { target: { value: "1800" } }); });
    await press(moveButton());
    expect(repo.relocate).toHaveBeenCalledWith(42, { place_id: 3, hourly_rate: 1800 });
  });

  test("a limited seat needs its limit accepted, and sends that limit verbatim", async () => {
    await mount();
    await press(seat(4));
    expect(moveButton().disabled).toBe(true);

    await press(screen.getByText(/session\.relocateAcceptLimit/));
    await press(moveButton());
    expect(repo.relocate).toHaveBeenCalledWith(42, { place_id: 4, until: FREE_UNTIL });
  });

  test("a seat taken meanwhile is refused: warned, the list redrawn, nothing moved", async () => {
    repo.relocate.mockRejectedValue(Object.assign(new Error("That place is no longer free."), { status: 409 }));
    await mount();
    await press(seat(2));
    await press(moveButton());

    expect(onMoved).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("№2"));
    expect(repo.relocationOptions).toHaveBeenCalledTimes(2);
    expect(screen.getByText("That place is no longer free.")).toBeTruthy();
    expect(moveButton().disabled).toBe(true);
  });
});
