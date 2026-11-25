// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repo = vi.hoisted(() => ({ updateTimeBonus: vi.fn() }));
vi.mock("@/repositories/BonusRepository", () => ({ bonusRepository: repo }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}` }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

import TimeBonusSettingsForm from "./TimeBonusSettingsForm";

const saved = vi.fn();
const mount = () => render(<TimeBonusSettingsForm branchId={7} onSaved={saved}
  settings={{ enabled: false, from: "13:00", to: "18:00", minutes: 30, per_window: 1 }} />);

beforeEach(() => { repo.updateTimeBonus.mockReset(); repo.updateTimeBonus.mockImplementation((_b, body) => Promise.resolve(body)); saved.mockReset(); });
afterEach(cleanup);

describe("TimeBonusSettingsForm", () => {
  test("nothing changed: Save is off", () => {
    mount();
    expect((screen.getByTestId("time-bonus-save") as HTMLButtonElement).disabled).toBe(true);
  });

  test("switched on: sends the whole rule to the branch", async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole("switch")); });
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-save")); });
    expect(repo.updateTimeBonus).toHaveBeenCalledWith(7, { enabled: true, from: "13:00", to: "18:00", minutes: 30, per_window: 1 });
    expect(saved).toHaveBeenCalled();
  });

  test("the counts carry no «%» (2026-11-25, found in the browser)", () => {
    const { container } = mount();
    expect(container.textContent).not.toContain("%");
  });

  test("the same start and end cannot be saved", async () => {
    mount();
    const [from] = screen.getAllByRole("textbox");
    await act(async () => { fireEvent.change(from, { target: { value: "18:00" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("switch")); });
    expect((screen.getByTestId("time-bonus-save") as HTMLButtonElement).disabled).toBe(true);
  });
});
