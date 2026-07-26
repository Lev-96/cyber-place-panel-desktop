// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PasswordResetCard from "./PasswordResetCard";

const api = vi.hoisted(() => ({
  send: vi.fn(),
  verify: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@/api/auth", () => ({
  apiSendPasswordResetCode: (email: string) => api.send(email),
  apiVerifyPasswordResetCode: (email: string, code: string) => api.verify(email, code),
  apiConfirmPasswordResetCode: (body: unknown) => api.confirm(body),
  // The link-based flow must NOT be reachable from this card any more.
  apiForgotPassword: () => { throw new Error("the reset-link flow must not be used here"); },
  apiResetPassword: () => { throw new Error("the reset-link flow must not be used here"); },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

const EMAIL = "ani@cyberplace.pro";

afterEach(() => cleanup());
beforeEach(() => {
  api.send.mockReset().mockResolvedValue({ message: "ok" });
  api.verify.mockReset().mockResolvedValue({ valid: true });
  api.confirm.mockReset().mockResolvedValue({ message: "ok" });
});

const click = async (label: string) => {
  await act(async () => { fireEvent.click(screen.getByText(label)); });
};
const passwordFields = () => Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
const typeCode = async (value: string) => {
  const input = document.querySelector('input:not([type="password"])') as HTMLInputElement;
  await act(async () => { fireEvent.change(input, { target: { value } }); });
};
const newPasswordsAreOpen = () =>
  document.querySelector('.cp-reveal[data-open="true"]') !== null;

describe("PasswordResetCard", () => {
  test("mails the one-time code to the account being recovered", async () => {
    render(<PasswordResetCard email={EMAIL} />);
    await click("profile.sendCode");

    expect(api.send).toHaveBeenCalledWith(EMAIL);
  });

  test("keeps the new-password fields shut until the code is confirmed server-side", async () => {
    api.verify.mockResolvedValue({ valid: false });
    render(<PasswordResetCard email={EMAIL} />);

    await click("profile.sendCode");
    expect(newPasswordsAreOpen()).toBe(false);

    await typeCode("000000");
    await click("profile.confirmCode");

    expect(api.verify).toHaveBeenCalledWith(EMAIL, "000000");
    expect(newPasswordsAreOpen()).toBe(false);
    expect(screen.getByText("profile.errInvalidCode")).toBeTruthy();
  });

  test("a confirmed code opens the fields and sets the new password", async () => {
    const onDone = vi.fn();
    render(<PasswordResetCard email={EMAIL} onDone={onDone} />);

    await click("profile.sendCode");
    await typeCode("123456");
    await click("profile.confirmCode");
    expect(newPasswordsAreOpen()).toBe(true);

    const [next, repeat] = passwordFields();
    await act(async () => { fireEvent.change(next, { target: { value: "brand-new-pass" } }); });
    await act(async () => { fireEvent.change(repeat, { target: { value: "brand-new-pass" } }); });
    await click("settings.updatePassword");

    expect(api.confirm).toHaveBeenCalledWith({
      email: EMAIL,
      code: "123456",
      new_password: "brand-new-pass",
      new_password_confirmation: "brand-new-pass",
    });
    expect(onDone).toHaveBeenCalledWith("brand-new-pass");
  });

  test("mismatched or too-short passwords are never submitted", async () => {
    render(<PasswordResetCard email={EMAIL} />);
    await click("profile.sendCode");
    await typeCode("123456");
    await click("profile.confirmCode");

    const [next, repeat] = passwordFields();
    await act(async () => { fireEvent.change(next, { target: { value: "short" } }); });
    await act(async () => { fireEvent.change(repeat, { target: { value: "short" } }); });
    await click("settings.updatePassword");
    expect(api.confirm).not.toHaveBeenCalled();

    await act(async () => { fireEvent.change(next, { target: { value: "long-enough-pass" } }); });
    await act(async () => { fireEvent.change(repeat, { target: { value: "long-enough-typo" } }); });
    await click("settings.updatePassword");
    expect(api.confirm).not.toHaveBeenCalled();
  });
});
