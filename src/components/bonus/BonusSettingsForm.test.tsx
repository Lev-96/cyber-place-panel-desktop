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
});
