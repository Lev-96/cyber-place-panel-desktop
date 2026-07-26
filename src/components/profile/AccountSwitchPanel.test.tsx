// @vitest-environment jsdom
import { IAccountSwitchTarget } from "@/api/accountSwitch";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AccountSwitchPanel from "./AccountSwitchPanel";

const repo = vi.hoisted(() => ({ targets: vi.fn() }));
vi.mock("@/repositories/AccountSwitchRepository", () => ({
  accountSwitchRepository: { targets: () => repo.targets() },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

const OWNER: IAccountSwitchTarget = {
  id: 9, name: "Levon Bakunts", email: "levon@cyberplace.pro", role: "company_owner", branch: null,
};
const COLLEAGUE: IAccountSwitchTarget = {
  id: 42, name: "Ani Petrosyan", email: "ani@cyberplace.pro", role: "manager",
  branch: { id: 3, address: "Mashtots 5", city: "Yerevan" },
};

afterEach(() => cleanup());
beforeEach(() => { repo.targets.mockReset(); });

const mount = async () => {
  await act(async () => { render(<AccountSwitchPanel onBack={vi.fn()} onPick={vi.fn()} />); });
};

describe("AccountSwitchPanel", () => {
  test("lists exactly what the backend offered, in both roles", async () => {
    repo.targets.mockResolvedValue([OWNER, COLLEAGUE]);
    await mount();

    expect(screen.getByText("Levon Bakunts")).toBeTruthy();
    expect(screen.getByText("Ani Petrosyan")).toBeTruthy();
    expect(screen.getByText("role.company_owner")).toBeTruthy();
    expect(screen.getByText("role.manager")).toBeTruthy();
    // The branch of the manager is shown, the owner simply has none.
    expect(screen.getByText("Mashtots 5")).toBeTruthy();
  });

  test("picking an account hands the target upwards untouched", async () => {
    repo.targets.mockResolvedValue([OWNER, COLLEAGUE]);
    const onPick = vi.fn();
    await act(async () => { render(<AccountSwitchPanel onBack={vi.fn()} onPick={onPick} />); });

    await act(async () => { fireEvent.click(screen.getByText("Ani Petrosyan")); });

    expect(onPick).toHaveBeenCalledWith(COLLEAGUE);
  });

  test("an empty roster says so instead of rendering a blank box", async () => {
    repo.targets.mockResolvedValue([]);
    await mount();

    expect(screen.getByText("switchAccount.empty")).toBeTruthy();
  });

  test("back returns to the account menu", async () => {
    repo.targets.mockResolvedValue([OWNER]);
    const onBack = vi.fn();
    await act(async () => { render(<AccountSwitchPanel onBack={onBack} onPick={vi.fn()} />); });

    await act(async () => { fireEvent.click(screen.getByLabelText("action.back")); });

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
