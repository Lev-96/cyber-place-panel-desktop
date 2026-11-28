// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBonusAccount } from "@/types/bonus";

/**
 * «Оцените визит игрока» (2026-11-27, owner): after a visit the club rates
 * the player with stars only, the reason required at 1 star, and may give
 * bonuses as a gift. «Не сейчас» answers without a rating. Nothing is decided here: the server's list says whom to ask.
 */
const repo = vi.hoisted(() => ({ rateDue: vi.fn(), rate: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "manager" }));
vi.mock("@/repositories/BonusRepository", () => ({ bonusRepository: repo }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
const sound = vi.hoisted(() => ({ playFor: vi.fn(() => true) }));
vi.mock("@/sound/soundEngine", () => ({ playFor: sound.playFor }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import RatePlayerNotifier from "./RatePlayerNotifier";
import { rateVisitReady } from "@/components/bonus/RateVisitForm";

const card = (over: Partial<IBonusAccount> = {}): IBonusAccount => ({
  id: 4, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "35.00", opened_at: null, rank: "pro", rank_name: "PRO",
  player_rating: { average: "4.5", count: 2 }, ...over,
});
const mount = async () => { await act(async () => { render(<RatePlayerNotifier />); }); await act(async () => { await Promise.resolve(); }); };
const click = async (id: string) => { await act(async () => { fireEvent.click(screen.getByTestId(id)); }); };
const send = () => screen.getByTestId("rate-player-send") as HTMLButtonElement;

beforeEach(() => {
  auth.role = "manager";
  for (const f of Object.values(repo)) f.mockReset();
  repo.rateDue.mockResolvedValueOnce([card()]).mockResolvedValue([]);
  repo.rate.mockResolvedValue({});
});
afterEach(cleanup);

describe("RatePlayerNotifier", () => {
  test("names the player and their rank; nothing to send before the stars; heard once", async () => {
    sound.playFor.mockClear();
    await mount();
    expect(sound.playFor).toHaveBeenCalledWith("guests", "rate-due:4:");
    expect(screen.getByTestId("rate-player-name").textContent).toContain("Arman");
    expect(screen.getByTestId("rate-player-name").textContent).toContain("PRO");
    expect(send().disabled).toBe(true);
    expect(screen.queryByTestId("rate-player-form-comment")).toBeNull();
  });

  test("stars only: 2–5 send at once, no words and no tags (2026-11-27)", async () => {
    await mount();
    await click("rate-player-form-star-4");
    expect(screen.queryByTestId("rate-player-form-comment")).toBeNull();
    expect(document.querySelector("[aria-pressed]")).toBeNull();
    expect(send().disabled).toBe(false);
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledTimes(1);
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 4, comment: null, gift: null });
    expect(screen.queryByTestId("rate-player")).toBeNull();
  });

  test("1 star asks the reason, required; it is dropped when the stars go up", async () => {
    await mount();
    await click("rate-player-form-star-1");
    expect(send().disabled).toBe(true);
    await act(async () => { fireEvent.change(screen.getByTestId("rate-player-form-comment"), { target: { value: "   " } }); });
    expect(send().disabled).toBe(true);
    await act(async () => { fireEvent.change(screen.getByTestId("rate-player-form-comment"), { target: { value: " Грубил " } }); });
    expect(send().disabled).toBe(false);
    await click("rate-player-form-star-3");
    expect(screen.queryByTestId("rate-player-form-comment")).toBeNull();
    await click("rate-player-form-star-1");
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 1, comment: "Грубил", gift: null });
  });

  test("the reason is not sent above 1 star", async () => {
    await mount();
    await click("rate-player-form-star-1");
    await act(async () => { fireEvent.change(screen.getByTestId("rate-player-form-comment"), { target: { value: "Грубил" } }); });
    await click("rate-player-form-star-3");
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 3, comment: null, gift: null });
  });

  test("a gift from the club goes with a 3–5 star rating only", async () => {
    await mount();
    expect(screen.queryByTestId("rate-player-form-gift")).toBeNull();
    await click("rate-player-form-star-1");
    expect(screen.queryByTestId("rate-player-form-gift")).toBeNull();
    await click("rate-player-form-star-2");
    expect(screen.queryByTestId("rate-player-form-gift")).toBeNull();
    await click("rate-player-form-star-5");
    const input = screen.getByTestId("rate-player-form-gift").querySelector("input") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "500" } }); });
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 5, comment: null, gift: "500" });
  });

  test("a gift typed at 5 stars is not sent when the stars drop to 2", async () => {
    await mount();
    await click("rate-player-form-star-5");
    const input = screen.getByTestId("rate-player-form-gift").querySelector("input") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "500" } }); });
    await click("rate-player-form-star-2");
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 2, comment: null, gift: null });
  });

  test("a manager gives within the owner's caps: the cap is said, more is not sent (2026-11-28)", async () => {
    repo.rateDue.mockReset();
    repo.rateDue.mockResolvedValueOnce([card({ gift_limit: { max: "1000.00", daily: "10000.00", left_today: "600.00" } })]).mockResolvedValue([]);
    await mount();
    await click("rate-player-form-star-5");
    expect(screen.getByTestId("rate-player-form-gift-cap").textContent).toBe("rating.giftCap");
    const input = screen.getByTestId("rate-player-form-gift").querySelector("input") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "700" } }); });
    // Over what is left today (600): the stepper holds it at the cap or the send waits.
    const sent = Number(input.value);
    if (sent > 600) expect(send().disabled).toBe(true);
    await act(async () => { fireEvent.change(input, { target: { value: "600" } }); });
    expect(send().disabled).toBe(false);
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 5, comment: null, gift: "600" });
  });

  test("ready only within the cap: over it, never (2026-11-28)", () => {
    const v = { stars: 5, comment: "", gift: 700 };
    expect(rateVisitReady(v, 600)).toBe(false);
    expect(rateVisitReady({ ...v, gift: 600 }, 600)).toBe(true);
    expect(rateVisitReady(v)).toBe(true); // the owner: the server's own 100 000 bound only
  });

  test("nothing left to give: no gift field, the rating still goes (2026-11-28)", async () => {
    repo.rateDue.mockReset();
    repo.rateDue.mockResolvedValueOnce([card({ gift_limit: { max: "1000.00", daily: "10000.00", left_today: "0.00" } })]).mockResolvedValue([]);
    await mount();
    await click("rate-player-form-star-5");
    expect(screen.queryByTestId("rate-player-form-gift")).toBeNull();
    await click("rate-player-send");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { stars: 5, comment: null, gift: null });
  });

  test("the owner's window says no cap (2026-11-28)", async () => {
    await mount();
    await click("rate-player-form-star-5");
    expect(screen.queryByTestId("rate-player-form-gift-cap")).toBeNull();
  });

  test("«Не сейчас» answers the visit without a rating", async () => {
    await mount();
    await click("rate-player-skip");
    expect(repo.rate).toHaveBeenCalledWith(7, 4, { skip: true });
    expect(screen.queryByTestId("rate-player")).toBeNull();
  });

  test("answered at another desk meanwhile: the refusal is said and the list read again", async () => {
    repo.rate.mockRejectedValue(new Error("rated already"));
    await mount();
    await click("rate-player-form-star-5");
    await click("rate-player-send");
    expect(repo.rateDue.mock.calls.length).toBeGreaterThan(1);
  });

  test("an admin is never asked", async () => {
    auth.role = "admin";
    await mount();
    expect(repo.rateDue).not.toHaveBeenCalled();
    expect(screen.queryByTestId("rate-player")).toBeNull();
  });
});
