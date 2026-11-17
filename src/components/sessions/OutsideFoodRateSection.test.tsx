// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISessionApi } from "@/types/sessions";

/**
 * «Свои продукты» as the seat's rate during the game (2026-11-17): shown only
 * where the venue charges own food as a rate (the server's start-options for
 * this seat) or where it is already on; the server decides everything.
 */
const repo = vi.hoisted(() => ({ startOptions: vi.fn(), setOutsideFoodRate: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    startOptions: (...a: unknown[]) => repo.startOptions(...a),
    setOutsideFoodRate: (...a: unknown[]) => repo.setOutsideFoodRate(...a),
  },
}));
vi.mock("@/components/ui/PriceInput", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import OutsideFoodRateSection from "./OutsideFoodRateSection";

const t = (k: string) => (k === "session.foodRate.isOn" || k.endsWith("Toast") ? `${k}: {0} {1}` : k);
const money = (n: number) => String(n);
const session = (over: Partial<ISessionApi> = {}) => ({ id: 42, pc_id: 7, hourly_rate: 2500, ...over }) as unknown as ISessionApi;
const run = vi.fn(async (action: () => Promise<ISessionApi>) => { await action(); return true; });

const mount = async (s: ISessionApi) => {
  await act(async () => { render(<OutsideFoodRateSection session={s} disabled={false} run={run} t={t} money={money} />); });
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  repo.startOptions.mockReset();
  repo.setOutsideFoodRate.mockReset();
  repo.setOutsideFoodRate.mockResolvedValue(session());
  run.mockClear();
});
afterEach(cleanup);

describe("OutsideFoodRateSection", () => {
  test("a venue on the fixed fee: nothing shown", async () => {
    repo.startOptions.mockResolvedValue({ outside_food_fee: 4000, outside_food_mode: "fixed" });
    await mount(session());
    expect(screen.queryByTestId("outside-food-rate-section")).toBeNull();
  });

  test("an unreadable answer: nothing shown, nothing broken", async () => {
    repo.startOptions.mockRejectedValue(new Error("offline"));
    await mount(session());
    expect(screen.queryByTestId("outside-food-rate-section")).toBeNull();
  });

  test("a venue on the rate: the venue's 4 000 prefilled, «Switch on» sends it", async () => {
    repo.startOptions.mockResolvedValue({ outside_food_fee: 4000, outside_food_mode: "tariff" });
    await mount(session());
    expect((screen.getByLabelText("session.foodRate.price") as HTMLInputElement).value).toBe("4000");
    await act(async () => { fireEvent.click(screen.getByTestId("outside-food-rate-apply")); });
    expect(repo.setOutsideFoodRate).toHaveBeenCalledWith(42, true, 4000);
    expect(screen.queryByTestId("outside-food-rate-off")).toBeNull();
  });

  test("on: says the rate and the seat's own, a new price is sent, and off goes back", async () => {
    repo.startOptions.mockResolvedValue({ outside_food_fee: 4000, outside_food_mode: "tariff" });
    await mount(session({ outside_food_rate: 4000, rate_before_outside_food: 2500 }));
    expect(screen.getByTestId("outside-food-rate-state").textContent).toContain("4000session.perHourShort");
    expect(screen.getByTestId("outside-food-rate-state").textContent).toContain("2500session.perHourShort");
    // The same price is nothing to change.
    expect((screen.getByTestId("outside-food-rate-apply") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.change(screen.getByLabelText("session.foodRate.price"), { target: { value: "3000" } }); });
    await act(async () => { fireEvent.click(screen.getByTestId("outside-food-rate-apply")); });
    expect(repo.setOutsideFoodRate).toHaveBeenLastCalledWith(42, true, 3000);
    await act(async () => { fireEvent.click(screen.getByTestId("outside-food-rate-off")); });
    expect(repo.setOutsideFoodRate).toHaveBeenLastCalledWith(42, false);
  });

  test("already on is shown even if the venue later went back to the fixed fee — so it can be switched off", async () => {
    repo.startOptions.mockResolvedValue({ outside_food_fee: 4000, outside_food_mode: "fixed" });
    await mount(session({ outside_food_rate: 4000, rate_before_outside_food: 2500 }));
    expect(screen.getByTestId("outside-food-rate-off")).toBeTruthy();
  });
});
