// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repo = vi.hoisted(() => ({ lookup: vi.fn(), register: vi.fn() }));
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: { lookup: (...a: unknown[]) => repo.lookup(...a), register: (...a: unknown[]) => repo.register(...a) },
}));
vi.mock("@/components/scanner/QrScanner", () => ({ default: () => null }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

import RegisterBonusDialog from "./RegisterBonusDialog";

afterEach(() => cleanup());
beforeEach(() => { repo.lookup.mockReset(); repo.register.mockReset(); });

const mount = (onSaved = vi.fn()) => render(<RegisterBonusDialog branchId={7} onClose={vi.fn()} onSaved={onSaved} />);
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };

describe("registering a player at the till", () => {
  test("a code that cannot be one never reaches the server", async () => {
    mount();
    fireEvent.change(screen.getByTestId("bonus-code"), { target: { value: "AB1" } });
    await press("bonus.register.check");
    expect(repo.lookup).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("bonus.register.codeInvalid");
  });

  test("a code that already has a card here stops at step one", async () => {
    repo.lookup.mockResolvedValue({ code: "ABC234", registered: true, account: null });
    mount();
    fireEvent.change(screen.getByTestId("bonus-code"), { target: { value: "abc234" } });
    await press("bonus.register.check");
    expect(repo.lookup).toHaveBeenCalledWith(7, "ABC234");
    expect(screen.getByRole("alert").textContent).toBe("bonus.register.already");
    expect(screen.queryByTestId("bonus-phone")).toBeNull();
  });

  test("a free code, a name and a valid phone open the card with the phone in E.164", async () => {
    repo.lookup.mockResolvedValue({ code: "ABC234", registered: false, account: null });
    const account = { id: 1, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "500.00", opened_at: null };
    repo.register.mockResolvedValue(account);
    const onSaved = vi.fn();
    mount(onSaved);
    fireEvent.change(screen.getByTestId("bonus-code"), { target: { value: "ABC234" } });
    await press("bonus.register.check");
    fireEvent.change(screen.getByTestId("bonus-name"), { target: { value: " Arman " } });
    fireEvent.change(screen.getByTestId("bonus-phone"), { target: { value: "091 123 456" } });
    await press("bonus.register.open");
    expect(repo.register).toHaveBeenCalledWith(7, { code: "ABC234", name: "Arman", phone: "+37491123456" });
    expect(onSaved).toHaveBeenCalledWith(account);
  });

  test("the player's own name and phone are offered and sent as they are", async () => {
    repo.lookup.mockResolvedValue({ code: "ABC234", registered: false, account: null, player: { name: "Арман", phone: "+37491556677" } });
    repo.register.mockResolvedValue({ id: 1, branch_id: 7, name: "Арман", phone: "+37491556677", balance: "0.00", opened_at: null });
    mount();
    fireEvent.change(screen.getByTestId("bonus-code"), { target: { value: "ABC234" } });
    await press("bonus.register.check");
    expect((screen.getByTestId("bonus-name") as HTMLInputElement).value).toBe("Арман");
    await press("bonus.register.open");
    expect(repo.register).toHaveBeenCalledWith(7, { code: "ABC234", name: "Арман", phone: "+37491556677" });
  });

  test("no smartphone: name and phone only, no code is sent", async () => {
    repo.register.mockResolvedValue({ id: 2, branch_id: 7, name: "Gor", phone: "+37493112233", balance: "0.00", opened_at: null });
    mount();
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-by-phone")); });
    fireEvent.change(screen.getByTestId("bonus-name"), { target: { value: "Gor" } });
    fireEvent.change(screen.getByTestId("bonus-phone"), { target: { value: "093 11 22 33" } });
    await press("bonus.register.open");
    expect(repo.lookup).not.toHaveBeenCalled();
    expect(repo.register).toHaveBeenCalledWith(7, { name: "Gor", phone: "+37493112233" });
  });

  test("«по номеру телефона» opened and closed with nothing typed leaves at once (2026-11-25, seen in the browser)", async () => {
    const onClose = vi.fn();
    render(<RegisterBonusDialog branchId={7} onClose={onClose} onSaved={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-by-phone")); });
    fireEvent.click(document.querySelector(".cp-modal-close") as HTMLButtonElement);
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a name typed: closing asks first", async () => {
    const onClose = vi.fn();
    render(<RegisterBonusDialog branchId={7} onClose={onClose} onSaved={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByTestId("bonus-by-phone")); });
    fireEvent.change(screen.getByTestId("bonus-name"), { target: { value: "Gor" } });
    fireEvent.click(document.querySelector(".cp-modal-close") as HTMLButtonElement);
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("an invalid phone cannot be sent", async () => {
    repo.lookup.mockResolvedValue({ code: "ABC234", registered: false, account: null });
    mount();
    fireEvent.change(screen.getByTestId("bonus-code"), { target: { value: "ABC234" } });
    await press("bonus.register.check");
    fireEvent.change(screen.getByTestId("bonus-phone"), { target: { value: "12" } });
    expect((screen.getByRole("button", { name: "bonus.register.open" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
