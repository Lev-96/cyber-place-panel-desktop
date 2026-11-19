// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISessionApi } from "@/types/sessions";

/**
 * The seat's price per hour changed during the game (2026-11-19): the server
 * does it from now; the panel only sends the typed price and shows the answer.
 */
const repo = vi.hoisted(() => ({ setHourlyRate: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: { setHourlyRate: (...a: unknown[]) => repo.setHourlyRate(...a) },
}));
vi.mock("@/components/ui/PriceInput", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import HourlyRateSection from "./HourlyRateSection";

const t = (k: string) => (k === "session.rate.now" || k.endsWith("Toast") ? `${k}: {0}` : k);
const money = (n: number) => String(n);
const session = (over: Partial<ISessionApi> = {}) =>
  ({ id: 42, pc_id: 7, hourly_rate: "1000.00", tariff_hourly_rate: 1000, ...over }) as unknown as ISessionApi;
const run = vi.fn(async (action: () => Promise<ISessionApi>, _m?: number | null, _toast?: string | null) => { await action(); return true; });

const mount = (s: ISessionApi) => render(<HourlyRateSection session={s} disabled={false} run={run} t={t} money={money} />);
const box = () => screen.getByLabelText("session.rate.title") as HTMLInputElement;
const save = () => screen.getByTestId("hourly-rate-save") as HTMLButtonElement;

beforeEach(() => {
  repo.setHourlyRate.mockReset();
  repo.setHourlyRate.mockResolvedValue(session({ hourly_rate: "800.00", tariff_hourly_rate: 800 } as Partial<ISessionApi>));
  run.mockClear();
});
afterEach(cleanup);

describe("HourlyRateSection", () => {
  test("shows the price now, prefilled; the same price cannot be saved", () => {
    mount(session());
    expect(screen.getByTestId("hourly-rate-now").textContent).toBe("session.rate.now: 1000session.perHourShort");
    expect(box().value).toBe("1000");
    expect(save().disabled).toBe(true);
  });

  test("1 000 → 800: sends exactly 800 for this seat, with the toast", async () => {
    mount(session());
    fireEvent.change(box(), { target: { value: "800" } });
    expect(save().disabled).toBe(false);
    await act(async () => { fireEvent.click(save()); });
    expect(repo.setHourlyRate).toHaveBeenCalledTimes(1);
    expect(repo.setHourlyRate).toHaveBeenCalledWith(42, 800);
    expect(run.mock.calls[0][2]).toBe("session.rate.savedToast: 800session.perHourShort");
  });

  test("a comma is a decimal point; nothing, zero or text cannot be saved", () => {
    mount(session());
    fireEvent.change(box(), { target: { value: "850,5" } });
    expect(save().disabled).toBe(false);
    for (const bad of ["", "0", "-5", "abc"]) {
      fireEvent.change(box(), { target: { value: bad } });
      expect(save().disabled).toBe(true);
    }
  });

  test("not shown on a free seat, with own food as the rate, or with no price", () => {
    mount(session({ is_free: true } as Partial<ISessionApi>));
    expect(screen.queryByTestId("hourly-rate-section")).toBeNull();
    cleanup();
    mount(session({ outside_food_rate: 1500 } as Partial<ISessionApi>));
    expect(screen.queryByTestId("hourly-rate-section")).toBeNull();
    cleanup();
    mount(session({ hourly_rate: null, tariff_hourly_rate: null } as Partial<ISessionApi>));
    expect(screen.queryByTestId("hourly-rate-section")).toBeNull();
  });
});
