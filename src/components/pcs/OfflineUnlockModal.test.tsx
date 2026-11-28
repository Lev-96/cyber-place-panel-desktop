// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** A PC's own offline emergency code (2026-11-28): shown in two groups of four; «Новый код» asks first. */
const repo = vi.hoisted(() => ({ offlineUnlock: vi.fn(), rotateOfflineUnlock: vi.fn() }));
const ask = vi.hoisted(() => ({ answer: true }));
vi.mock("@/repositories/PcRepository", () => ({ pcRepository: repo }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => vi.fn(async () => ask.answer) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import OfflineUnlockModal from "./OfflineUnlockModal";

const pc = { id: 12, label: "PC 7" } as never;
beforeEach(() => {
  ask.answer = true;
  repo.offlineUnlock.mockReset().mockResolvedValue({ code: "04812937", rotated_at: null });
  repo.rotateOfflineUnlock.mockReset().mockResolvedValue({ code: "55501234", rotated_at: null });
});
afterEach(cleanup);

describe("OfflineUnlockModal", () => {
  test("reads this PC's code and shows it in two groups of four (leading zero kept)", async () => {
    await act(async () => { render(<OfflineUnlockModal pc={pc} onClose={vi.fn()} />); });
    expect(repo.offlineUnlock).toHaveBeenCalledWith(12);
    expect(screen.getByTestId("offline-unlock-code").textContent).toBe("0481 2937");
  });

  test("«Новый код» asks first; refused, nothing changes; agreed, the new code shows", async () => {
    await act(async () => { render(<OfflineUnlockModal pc={pc} onClose={vi.fn()} />); });
    ask.answer = false;
    await act(async () => { fireEvent.click(screen.getByTestId("offline-unlock-renew")); });
    expect(repo.rotateOfflineUnlock).not.toHaveBeenCalled();
    ask.answer = true;
    await act(async () => { fireEvent.click(screen.getByTestId("offline-unlock-renew")); });
    expect(repo.rotateOfflineUnlock).toHaveBeenCalledWith(12);
    expect(screen.getByTestId("offline-unlock-code").textContent).toBe("5550 1234");
  });
});
