// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The console user's PS5 login passcode field (2026-11-08): what Stop needs
 * on a console whose user has a passcode and nobody is signed in on it.
 * Saved through the bridge, never readable back, cleared once saved.
 */

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

let bridge: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  bridge = {
    hasPasscode: vi.fn(async () => ({ has: false })),
    setPasscode: vi.fn(async () => ({ saved: true, persisted: true })),
    forgetPasscode: vi.fn(async () => ({ ok: true })),
  };
  (globalThis as Record<string, unknown>).cyberplacePS5 = bridge;
});
afterEach(() => {
  cleanup();
  delete (globalThis as Record<string, unknown>).cyberplacePS5;
});

const mount = async (onChanged = vi.fn()) => {
  const { default: Field } = await import("./ConsolePasscodeField");
  render(<Field hostId="BC3329D4318D" onChanged={onChanged} />);
  return onChanged;
};

describe("the PS5 login passcode field", () => {
  test("saves four digits for this console, clears the box and tells the watcher", async () => {
    const onChanged = await mount();
    const box = await screen.findByLabelText("ps5.passcode.label");
    fireEvent.change(box, { target: { value: "12a34" } });
    expect((box as HTMLInputElement).value).toBe("1234");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ps5.passcode.save" })); });

    expect(bridge.setPasscode).toHaveBeenCalledWith("BC3329D4318D", "1234");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/ps5.passcode.saved/)).toBeTruthy();
    expect(screen.queryByLabelText("ps5.passcode.label")).toBeNull();
  });

  test("the box is a password field: the code is not shown on the screen", async () => {
    await mount();
    const box = await screen.findByLabelText("ps5.passcode.label");
    expect(box.getAttribute("type")).toBe("password");
  });

  test("fewer than four digits cannot be saved", async () => {
    await mount();
    const box = await screen.findByLabelText("ps5.passcode.label");
    fireEvent.change(box, { target: { value: "123" } });
    expect((screen.getByRole("button", { name: "ps5.passcode.save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("a refused save says so and keeps the box", async () => {
    bridge.setPasscode = vi.fn(async () => ({ saved: false, reason: "bad-request" }));
    const onChanged = await mount();
    const box = await screen.findByLabelText("ps5.passcode.label");
    fireEvent.change(box, { target: { value: "1234" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ps5.passcode.save" })); });

    expect(screen.getByRole("alert").textContent).toBe("ps5.error.TRANSPORT_ERROR");
    expect(onChanged).not.toHaveBeenCalled();
  });

  test("a saved code can be removed", async () => {
    bridge.hasPasscode = vi.fn(async () => ({ has: true }));
    const onChanged = await mount();
    const remove = await screen.findByRole("button", { name: "ps5.passcode.forget" });
    await act(async () => { fireEvent.click(remove); });

    expect(bridge.forgetPasscode).toHaveBeenCalledWith("BC3329D4318D");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("ps5.passcode.label")).toBeTruthy();
  });

  test("an older build with no passcode store draws nothing", async () => {
    (globalThis as Record<string, unknown>).cyberplacePS5 = {};
    const { default: Field } = await import("./ConsolePasscodeField");
    const { container } = render(<Field hostId="X" onChanged={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
