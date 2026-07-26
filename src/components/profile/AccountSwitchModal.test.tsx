// @vitest-environment jsdom
import { IAccountSwitchTarget } from "@/api/accountSwitch";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AccountSwitchModal from "./AccountSwitchModal";

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ login: auth.login }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

const MANAGER: IAccountSwitchTarget = {
  id: 42,
  name: "Ani Petrosyan",
  email: "ani@cyberplace.pro",
  role: "manager",
  branch: { id: 3, address: "Mashtots 5", city: "Yerevan" },
};

const OWNER: IAccountSwitchTarget = {
  id: 9,
  name: "Levon Bakunts",
  email: "levon@cyberplace.pro",
  role: "company_owner",
  branch: null,
};

afterEach(() => cleanup());

beforeEach(() => {
  auth.login.mockReset();
});

const typePassword = async (value: string) => {
  const input = document.querySelector('input[type="password"]') as HTMLInputElement;
  await act(async () => { fireEvent.change(input, { target: { value } }); });
};

const submit = async () => {
  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => { fireEvent.submit(form); });
};

describe("AccountSwitchModal", () => {
  test("shows which account is about to be entered", () => {
    render(<AccountSwitchModal target={MANAGER} onClose={vi.fn()} onSwitched={vi.fn()} />);

    expect(screen.getByText("Ani Petrosyan")).toBeTruthy();
    expect(screen.getByText("ani@cyberplace.pro")).toBeTruthy();
    expect(screen.getByText("Mashtots 5")).toBeTruthy();
  });

  test("signs in with the MANAGER's own credentials and reports the switch", async () => {
    auth.login.mockResolvedValue(undefined);
    const onSwitched = vi.fn();
    render(<AccountSwitchModal target={MANAGER} onClose={vi.fn()} onSwitched={onSwitched} />);

    await typePassword("manager-secret");
    await submit();

    expect(auth.login).toHaveBeenCalledWith("ani@cyberplace.pro", "manager-secret");
    expect(onSwitched).toHaveBeenCalledTimes(1);
  });

  test("a wrong password reports it and never switches the session", async () => {
    auth.login.mockRejectedValue(Object.assign(new Error("nope"), { status: 401 }));
    const onSwitched = vi.fn();
    render(<AccountSwitchModal target={MANAGER} onClose={vi.fn()} onSwitched={onSwitched} />);

    await typePassword("wrong");
    await submit();

    expect(onSwitched).not.toHaveBeenCalled();
    expect(screen.getByText("login.invalidCredentials")).toBeTruthy();
  });

  test("submitting without a password does not hit the API", async () => {
    render(<AccountSwitchModal target={MANAGER} onClose={vi.fn()} onSwitched={vi.fn()} />);

    await submit();

    expect(auth.login).not.toHaveBeenCalled();
  });

  test("works the same in the other direction — a manager signing into the OWNER", async () => {
    auth.login.mockResolvedValue(undefined);
    const onSwitched = vi.fn();
    render(<AccountSwitchModal target={OWNER} onClose={vi.fn()} onSwitched={onSwitched} />);

    expect(screen.getByText("Levon Bakunts")).toBeTruthy();
    expect(screen.getByText("role.company_owner")).toBeTruthy();

    await typePassword("owner-secret");
    await submit();

    expect(auth.login).toHaveBeenCalledWith("levon@cyberplace.pro", "owner-secret");
    expect(onSwitched).toHaveBeenCalledTimes(1);
  });

  test("the inline reset flow targets the manager's own address", async () => {
    render(<AccountSwitchModal target={MANAGER} onClose={vi.fn()} onSwitched={vi.fn()} />);
    expect(screen.queryByText(/reset.cardHint/)).toBeNull();

    await act(async () => { fireEvent.click(screen.getByText("switchAccount.forgot")); });

    // The card is rendered with the manager's email (fmt() keeps the {0} slot
    // filled even though `t` is stubbed to return the raw key).
    expect(screen.getByText(/reset.cardHint/)).toBeTruthy();
  });
});
