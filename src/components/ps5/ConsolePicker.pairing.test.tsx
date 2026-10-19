// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * After a successful pairing the picker tells the console watcher (2026-10-19):
 * the watcher keeps its own "has a key" answer, and a stale "no" there is what
 * left a freshly paired console unwakeable until the panel restarted.
 */

const control = vi.hoisted(() => ({ credentialsChanged: vi.fn() }));
vi.mock("@/ps5/Ps5ControlProvider", () => ({ usePs5Control: () => control }));
// Place №9 is bound to this console: the key and pairing controls are shown
// only for a bound console.
vi.mock("@/repositories/PcRepository", () => ({
  pcRepository: {
    listConsoleDevices: async () => [{
      id: 116, branch_id: 4, label: "PS5", kind: "ps", console_host_id: "5C9666876D85", console_address: "192.168.1.35",
      place: { id: 9, number: 9, name: "PS5", type: "standard", platform: "ps5" },
    }],
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

const pairResult = vi.hoisted(() => ({ value: { ok: true } as { ok: boolean; code?: string } }));

beforeEach(() => {
  control.credentialsChanged.mockReset();
  pairResult.value = { ok: true };
  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    discover: async () => ({
      consoles: [{ hostId: "5C9666876D85", name: "PS5-172", type: "PS5", address: "192.168.1.35", state: "awake", systemVersion: "1" }],
      probed: ["192.168.1.255"], warnings: [],
    }),
    probe: async () => ({ consoles: [], probed: [], warnings: [] }),
    hasCredential: async () => ({ has: false, available: true, persisted: true }),
    setCredential: async () => ({ saved: true, persisted: true }),
    pair: async () => pairResult.value,
  };
});

afterEach(() => {
  cleanup();
  delete (globalThis as Record<string, unknown>).cyberplacePS5;
});

const pairWith = async (pin: string) => {
  const { default: ConsolePicker } = await import("./ConsolePicker");
  render(<ConsolePicker branchId={4} onClose={() => {}} />);
  const input = await screen.findByPlaceholderText("ps5.pair.pin");
  fireEvent.change(input, { target: { value: pin } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ps5.pair.start" })); });
};

describe("pairing in the picker", () => {
  test("a pairing that worked tells the watcher to ask the vault again", async () => {
    await pairWith("12345678");
    expect(control.credentialsChanged).toHaveBeenCalledTimes(1);
  });

  test("a pairing that failed tells it nothing", async () => {
    pairResult.value = { ok: false, code: "FAILED" };
    await pairWith("12345678");
    expect(control.credentialsChanged).not.toHaveBeenCalled();
  });
});
