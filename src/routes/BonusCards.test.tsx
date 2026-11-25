// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const repo = vi.hoisted(() => ({ settings: vi.fn(), list: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: { settings: (...a: unknown[]) => repo.settings(...a), list: (...a: unknown[]) => repo.list(...a) },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock("@/components/bonus/BonusSettingsForm", () => ({ default: () => <div data-testid="settings-form" /> }));
vi.mock("@/components/bonus/RegisterBonusDialog", () => ({ default: () => null }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n) }) }));

import BonusCards from "./BonusCards";

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter initialEntries={["/branches/7/bonus"]}><Routes><Route path="/branches/:branchId/bonus" element={<BonusCards />} /></Routes></MemoryRouter>);
  });
};
afterEach(() => cleanup());
beforeEach(() => { repo.settings.mockReset(); repo.list.mockReset(); auth.role = "company_owner"; });

describe("«Бонусные карты»", () => {
  test("the owner sees the rule and the branch's cards", async () => {
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([{ id: 1, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "35.00", opened_at: null }]);
    await mount();
    expect(screen.getByTestId("settings-form")).toBeTruthy();
    expect(screen.getByText("Arman")).toBeTruthy();
    expect(repo.list).toHaveBeenCalledWith(7, undefined);
    expect((screen.getByTestId("bonus-register-open") as HTMLButtonElement).disabled).toBe(false);
  });

  test("a manager never sees the rule", async () => {
    auth.role = "manager";
    repo.settings.mockResolvedValue({ enabled: true, percent: "5.00", welcome: "0.00" });
    repo.list.mockResolvedValue([]);
    await mount();
    expect(screen.queryByTestId("settings-form")).toBeNull();
    expect(screen.getByText("bonus.state.emptyTitle")).toBeTruthy();
  });

  test("switched off: registering is not offered", async () => {
    repo.settings.mockResolvedValue({ enabled: false, percent: "0.00", welcome: "0.00" });
    repo.list.mockResolvedValue([]);
    await mount();
    expect((screen.getByTestId("bonus-register-open") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("bonus.disabledHint").length).toBeGreaterThan(0);
  });
});
