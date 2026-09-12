// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ITournamentRegistration } from "@/api/tournamentRegistrations";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Removing a registration, driven down to the transport: `request()` is the
 * only thing replaced, so the assertions are about what the backend's
 * `DELETE /tournament-registration/{id}` would actually receive.
 *
 * Two reasons this is a confirmation in the in-app dialog and nowhere else:
 *  - a native `window.confirm()` poisons the Electron renderer's focus (the
 *    NEXT modal's inputs stop taking keystrokes), and it was what this list
 *    used until 2026-09-11;
 *  - the delete now REFUNDS a verified player's entry fee when the tournament
 *    has not ended, which takes it out of revenue and commission. The person
 *    pressing Remove must be told that before they confirm.
 */

interface Call { path: string; method: string; params?: Record<string, unknown> }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; params?: Record<string, unknown> }>,
  list: [] as unknown[],
  deleteResult: (): Promise<unknown> => Promise.resolve({ message: "Deleted" }),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; params?: Record<string, unknown> } = {}) => {
    const call: Call = { path, method: opts.method ?? "GET", params: opts.params };
    api.calls.push(call);
    if (call.method === "DELETE") return api.deleteResult();
    return Promise.resolve({ data: api.list });
  },
}));

// The verify widget above the list (camera, QR decoder) is not under test.
vi.mock("@/components/tournaments/VerifyCodeForm", () => ({ default: () => null }));

vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await vi.importActual<typeof import("@/i18n/translations")>("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});

import RegistrationsList from "./RegistrationsList";
import { t as translate } from "@/i18n/translations";

const VERIFIED: ITournamentRegistration = {
  id: 6,
  tournament_id: 2,
  guest_id: 11,
  as: "player",
  verified_at: "2026-09-11T19:25:00+04:00",
  verifier: { id: 1, name: "Ann" },
  guest: { id: 11, first_name: "Aram", last_name: "Petrosyan" },
  created_at: "2026-09-11T19:24:00+04:00",
};
const PENDING: ITournamentRegistration = {
  id: 7,
  tournament_id: 2,
  guest_id: 12,
  as: "player",
  verified_at: null,
  guest: { id: 12, first_name: "Lilit", last_name: "Hakobyan" },
};
const SPECTATOR: ITournamentRegistration = {
  id: 8,
  tournament_id: 2,
  guest_id: 13,
  as: "guest",
  guest: { id: 13, first_name: "Sona", last_name: "Grigoryan" },
};

const REFUND_NOTE = translate("registrations.removeRefundNote", "en");
const QUESTION = translate("registrations.confirmRemove", "en");

const deletes = () => api.calls.filter((c) => c.method === "DELETE");
const listReads = () => api.calls.filter((c) => c.method === "GET" && c.path === "/tournament-registration");

const mount = async () => {
  await act(async () => {
    render(
      <ConfirmProvider>
        <RegistrationsList tournamentId={2} />
      </ConfirmProvider>,
    );
  });
};

/** The row of the participant named `name`. */
const rowOf = (name: string) => screen.getByText(name).closest(".list-item") as HTMLElement;

const pressRemove = async (name: string) => {
  await act(async () => {
    fireEvent.click(within(rowOf(name)).getByRole("button", { name: "Remove" }));
  });
};

const answer = async (yes: boolean) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: yes ? "Confirm" : "Cancel" }));
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  api.calls = [];
  api.list = [VERIFIED, PENDING, SPECTATOR];
  api.deleteResult = () => Promise.resolve({ message: "Deleted" });
});

describe("RegistrationsList — removing a registration", () => {
  test("confirm → exactly one DELETE for that registration, then the list is read again", async () => {
    await mount();
    expect(listReads()).toHaveLength(1);

    await pressRemove("Aram Petrosyan");
    // Asking is not deleting.
    expect(deletes()).toHaveLength(0);

    await answer(true);

    expect(deletes()).toEqual([{ path: "/tournament-registration/6", method: "DELETE", params: undefined }]);
    expect(listReads()).toHaveLength(2);
  });

  test("cancel → no request at all, and the list is not re-read", async () => {
    await mount();

    await pressRemove("Aram Petrosyan");
    await answer(false);

    expect(deletes()).toHaveLength(0);
    expect(listReads()).toHaveLength(1);
    expect(screen.queryByText(REFUND_NOTE)).toBeNull();
  });

  test("never asks through a native confirm", async () => {
    const native = vi.spyOn(window, "confirm").mockReturnValue(true);
    await mount();

    await pressRemove("Aram Petrosyan");

    expect(native).not.toHaveBeenCalled();
    // …and nothing was deleted on the strength of a dialog nobody answered.
    expect(deletes()).toHaveLength(0);
  });

  test("a verified player: the dialog says the entry fee is refunded if the tournament has not ended", async () => {
    await mount();

    await pressRemove("Aram Petrosyan");

    const dialogText = screen.getByRole("button", { name: "Confirm" }).closest(".card")?.textContent ?? "";
    expect(dialogText).toContain(QUESTION);
    expect(dialogText).toContain(REFUND_NOTE);
    expect(REFUND_NOTE).toMatch(/refund/i);
    expect(REFUND_NOTE).toMatch(/not ended/i);
  });

  test.each([
    ["an unverified player", "Lilit Hakobyan"],
    ["a spectator", "Sona Grigoryan"],
  ])("%s never paid, so the dialog asks the plain question", async (_label, name) => {
    await mount();

    await pressRemove(name);

    const dialogText = screen.getByRole("button", { name: "Confirm" }).closest(".card")?.textContent ?? "";
    expect(dialogText).toContain(QUESTION);
    expect(dialogText).not.toContain(REFUND_NOTE);
  });

  test("a refused delete shows the server's reason and keeps the row", async () => {
    api.deleteResult = () => Promise.reject(new Error("You cannot manage this tournament."));
    await mount();

    await pressRemove("Aram Petrosyan");
    await answer(true);

    expect(deletes()).toHaveLength(1);
    expect(screen.getByText("You cannot manage this tournament.")).toBeTruthy();
    expect(screen.getByText("Aram Petrosyan")).toBeTruthy();
    expect(listReads()).toHaveLength(1);
  });
});

describe("the refund note is translated", () => {
  test.each(["en", "ru", "am"] as const)("%s", (lang) => {
    const note = translate("registrations.removeRefundNote", lang);
    expect(note).not.toBe("registrations.removeRefundNote");
    expect(note.length).toBeGreaterThan(0);
    if (lang !== "en") expect(note).not.toBe(REFUND_NOTE);
  });
});
