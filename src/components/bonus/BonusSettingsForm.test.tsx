// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repo = vi.hoisted(() => ({ updateSettings: vi.fn() }));
vi.mock("@/repositories/BonusRepository", () => ({ bonusRepository: { updateSettings: (...a: unknown[]) => repo.updateSettings(...a) } }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n) }) }));

import BonusSettingsForm from "./BonusSettingsForm";

const OFF = { enabled: false, percent: "0.00", welcome: "0.00" };
afterEach(() => cleanup());
beforeEach(() => repo.updateSettings.mockReset());

const set = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });

describe("the owner's bonus rule", () => {
  test("sends exactly what was typed, and the example uses the server's rounding (down)", async () => {
    repo.updateSettings.mockResolvedValue({ enabled: true, percent: "7.50", welcome: "500.00" });
    const onSaved = vi.fn();
    render(<BonusSettingsForm branchId={7} settings={OFF} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("switch"));
    set("bonus-percent", "7,5");
    set("bonus-welcome", "500");
    // 1 000 × 7.5 % = 75
    expect(screen.getByText("bonus.settings.example")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
    expect(repo.updateSettings).toHaveBeenCalledWith(7, { enabled: true, percent: 7.5, welcome: 500 });
    expect(onSaved).toHaveBeenCalled();
  });

  test("earning hours (2026-11-25): on → 10:00–16:00 sent; off again → null, every hour", async () => {
    repo.updateSettings.mockResolvedValue({});
    const NOW = { enabled: true, percent: "5.00", welcome: "0.00", earn_from: null, earn_to: null };
    render(<BonusSettingsForm branchId={7} settings={NOW} onSaved={vi.fn()} />);
    expect(screen.getByTestId("bonus-earn-hours-rule").textContent).toBe("bonus.settings.earnAlways");
    fireEvent.click(screen.getAllByRole("switch")[1]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
    expect(repo.updateSettings).toHaveBeenCalledWith(7, { enabled: true, percent: 5, welcome: 0, earn_from: "10:00", earn_to: "16:00" });
    cleanup(); repo.updateSettings.mockClear();
    render(<BonusSettingsForm branchId={7} settings={{ ...NOW, earn_from: "10:00", earn_to: "16:00" }} onSaved={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("switch")[1]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
    expect(repo.updateSettings).toHaveBeenCalledWith(7, { enabled: true, percent: 5, welcome: 0, earn_from: null, earn_to: null });
  });

  test("an older server (no earning hours in its answer): the hours are neither shown nor sent", () => {
    render(<BonusSettingsForm branchId={7} settings={OFF} onSaved={vi.fn()} />);
    expect(screen.queryByTestId("bonus-earn-hours-rule")).toBeNull();
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  test("a percent above 100 or text is not saved", async () => {
    render(<BonusSettingsForm branchId={7} settings={OFF} onSaved={vi.fn()} />);
    set("bonus-percent", "120");
    expect((screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement).disabled).toBe(true);
    set("bonus-percent", "abc");
    expect((screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  test("nothing changed: nothing to save", () => {
    render(<BonusSettingsForm branchId={7} settings={{ enabled: true, percent: "5.00", welcome: "0.00" }} onSaved={vi.fn()} />);
    expect((screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("the owner caps a manager's gift: per rating and per day, sent with the rule (2026-11-28)", async () => {
    repo.updateSettings.mockResolvedValue({ ...OFF, manager_gift: { max: "500.00", daily: "3000.00", left_today: "3000.00" } });
    render(<BonusSettingsForm branchId={7} settings={{ ...OFF, manager_gift: { max: "1000.00", daily: "10000.00", left_today: "8000.00" } }} onSaved={vi.fn()} />);
    expect((screen.getByTestId("bonus-manager-gift-max") as HTMLInputElement).value).toBe("1000");
    expect((screen.getByTestId("bonus-manager-gift-daily") as HTMLInputElement).value).toBe("10000");
    set("bonus-manager-gift-max", "500");
    set("bonus-manager-gift-daily", "3000");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
    expect(repo.updateSettings).toHaveBeenCalledWith(7, { enabled: false, percent: 0, welcome: 0, manager_gift_max: 500, manager_gift_daily: 3000 });
  });

  test("an older server without the caps: no fields, nothing extra sent", async () => {
    repo.updateSettings.mockResolvedValue(OFF);
    render(<BonusSettingsForm branchId={7} settings={OFF} onSaved={vi.fn()} />);
    expect(screen.queryByTestId("bonus-manager-gift")).toBeNull();
    set("bonus-welcome", "100");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
    expect(repo.updateSettings).toHaveBeenCalledWith(7, { enabled: false, percent: 0, welcome: 100 });
  });
});
