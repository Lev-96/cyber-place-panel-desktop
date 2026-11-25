// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repo = vi.hoisted(() => ({ updateTimeBonus: vi.fn() }));
vi.mock("@/repositories/BonusRepository", () => ({ bonusRepository: repo }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}`, lang: "ru" }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
// The seats of the branch (2026-11-25): №1 VIP and №2, №3 standard.
vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: { listRawByBranch: () => Promise.resolve([
    { id: 11, branch_id: 7, number: 1, name: "VIP", type: "vip", status: "active", platform: "ps5" },
    { id: 12, branch_id: 7, number: 2, name: null, type: "standard", status: "active", platform: "ps5" },
    { id: 13, branch_id: 7, number: 3, name: null, type: "standard", status: "active", platform: "ps5" },
  ]) },
}));

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
    await act(async () => { fireEvent.click(screen.getAllByRole("switch")[0]); });
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-save")); });
    expect(repo.updateTimeBonus).toHaveBeenCalledWith(7, { enabled: true, from: "13:00", to: "18:00", minutes: 30, per_window: 1, place_ids: null });
    expect(saved).toHaveBeenCalled();
  });

  test("the counts carry no «%» (2026-11-25, found in the browser)", () => {
    const { container } = mount();
    expect(container.textContent).not.toContain("%");
  });

  test("seats (2026-11-25): a whole group at once, then one seat off; none chosen cannot be saved", async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getAllByRole("switch")[1]); });
    await act(async () => { await Promise.resolve(); });
    expect((screen.getByTestId("time-bonus-save") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByTestId("seat-group-PS5")); });
    await act(async () => { fireEvent.click(screen.getByTestId("seat-13")); });
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-save")); });
    expect(repo.updateTimeBonus).toHaveBeenCalledWith(7, expect.objectContaining({ place_ids: [12] }));
  });

  test("the VIP group is its own: ticking it chooses only VIP seats", async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getAllByRole("switch")[1]); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("seat-group-PS5 · VIP")); });
    await act(async () => { fireEvent.click(screen.getByTestId("time-bonus-save")); });
    expect(repo.updateTimeBonus).toHaveBeenCalledWith(7, expect.objectContaining({ place_ids: [11] }));
  });

  test("the same start and end cannot be saved", async () => {
    mount();
    const [from] = screen.getAllByRole("textbox");
    await act(async () => { fireEvent.change(from, { target: { value: "18:00" } }); });
    await act(async () => { fireEvent.click(screen.getAllByRole("switch")[0]); });
    expect((screen.getByTestId("time-bonus-save") as HTMLButtonElement).disabled).toBe(true);
  });
});
