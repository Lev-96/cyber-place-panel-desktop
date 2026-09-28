// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Deleting a branch takes every place, session and booking under it, so it is
 * asked through the app's own destructive dialog (2026-09-28), never the
 * native `confirm()`, which poisons the Electron renderer's focus.
 */

const repo = vi.hoisted(() => ({
  byId: vi.fn(async () => ({ id: 3, address: "Main 1", city: "Yerevan", country: "AM", phone: null, places_count: 2, status: "open" })),
  remove: vi.fn(async () => undefined),
}));
vi.mock("@/repositories/BranchRepository", () => ({ branchRepository: repo }));
const asked = vi.hoisted(() => ({ fn: vi.fn(async (_m: string, _o?: unknown) => false) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => asked.fn }));
const nav = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useParams: () => ({ branchId: "3" }), useNavigate: () => nav }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/branches/BranchUnlockPinCard", () => ({ default: () => null }));
vi.mock("@/components/branches/BranchStatusPill", () => ({ default: () => null }));

import BranchEdit from "./BranchEdit";

describe("BranchEdit delete", () => {
  beforeEach(() => { repo.remove.mockClear(); asked.fn.mockClear(); nav.mockClear(); });
  afterEach(cleanup);

  const pressDelete = async () => fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  test("asks with the destructive dialog and deletes nothing on No", async () => {
    const native = vi.spyOn(window, "confirm").mockImplementation(() => { throw new Error("native confirm used"); });
    asked.fn.mockResolvedValueOnce(false);
    render(<BranchEdit />);
    await pressDelete();
    await waitFor(() => expect(asked.fn).toHaveBeenCalledTimes(1));
    expect(asked.fn.mock.calls[0][0]).toBe("Delete this branch and all related data?");
    expect(asked.fn.mock.calls[0][1]).toMatchObject({ destructive: true });
    expect(repo.remove).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    native.mockRestore();
  });

  test("deletes the branch and leaves for the list once confirmed", async () => {
    asked.fn.mockResolvedValueOnce(true);
    render(<BranchEdit />);
    await pressDelete();
    await waitFor(() => expect(nav).toHaveBeenCalledWith("/branches"));
    expect(repo.remove).toHaveBeenCalledWith(3);
  });
});
