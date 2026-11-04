// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Devices that serve no place (2026-11-04, owner: "Active Places shows 10,
 * Places shows 7"), driven down to the transport: `request()` is the only
 * thing replaced, so the assertions are about what the backend receives.
 *
 * The rules that protect money: a device a session runs on is never offered
 * for deletion — by the branch's running sessions OR the device's own status —
 * and a read that failed is "cannot tell", never "nothing runs".
 */
interface Call { path: string; method: string; params?: Record<string, unknown> }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; params?: Record<string, unknown> }>,
  pcs: [] as unknown[],
  sessions: [] as unknown[],
  sessionsError: null as unknown,
}));
vi.mock("@/api/client", () => ({
  // `useAsync` revalidates on cache changes; nothing here writes the cache.
  apiCache: { subscribe: () => () => {} },
  request: (path: string, opts: { method?: string; params?: Record<string, unknown> } = {}) => {
    const call: Call = { path, method: opts.method ?? "GET", params: opts.params };
    api.calls.push(call);
    if (call.method === "DELETE") return Promise.resolve({ message: "PC removed" });
    if (path === "/pcs") return Promise.resolve({ data: api.pcs });
    if (path === "/sessions") return api.sessionsError ? Promise.reject(api.sessionsError) : Promise.resolve({ data: api.sessions });
    return Promise.resolve({ data: [] });
  },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await vi.importActual<typeof import("@/i18n/translations")>("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});

import DevicesWithoutPlace from "./DevicesWithoutPlace";

const device = (id: number, label: string, over: Record<string, unknown> = {}) => ({
  id, branch_id: 4, place_id: null, label, kind: "ps", status: "online", place: null, ...over,
});
const placed = (id: number) => device(id, `Seat ${id}`, { place_id: 100 + id, place: { id: 100 + id, number: id, platform: "ps5" } });

const mount = async (canRemove = true, onRemoved = vi.fn()) => {
  await act(async () => {
    render(
      <ConfirmProvider>
        <DevicesWithoutPlace branchId={4} canRemove={canRemove} onRemoved={onRemoved} />
      </ConfirmProvider>,
    );
  });
  return onRemoved;
};
const removeButton = (id: number) => screen.getByTestId(`orphan-device-remove-${id}`) as HTMLButtonElement;
const deletes = () => api.calls.filter((c) => c.method === "DELETE");

beforeEach(() => {
  api.calls = [];
  api.pcs = [];
  api.sessions = [];
  api.sessionsError = null;
});
afterEach(cleanup);

describe("DevicesWithoutPlace", () => {
  test("every device has a place: nothing is shown", async () => {
    api.pcs = [placed(1), placed(2)];
    await mount();
    expect(screen.queryByTestId("devices-without-place")).toBeNull();
  });

  test("names the devices without a place, read the way the board reads them (every kind, this branch)", async () => {
    api.pcs = [placed(1), device(108, "№5"), device(121, "№11"), placed(2), device(122, "№12")];
    await mount();
    expect(screen.getByTestId("devices-without-place").textContent).toContain("Devices without a place: 3");
    for (const [id, label] of [[108, "№5"], [121, "№11"], [122, "№12"]] as const) {
      expect(screen.getByTestId(`orphan-device-${id}`).textContent).toContain(label);
    }
    expect(screen.queryByTestId("orphan-device-1")).toBeNull();
    const read = api.calls.find((c) => c.path === "/pcs")!;
    expect(read.params).toEqual({ branch_id: 4 });
  });

  test("a device a session runs on (by the branch's running sessions) cannot be deleted", async () => {
    api.pcs = [device(108, "№5"), device(121, "№11")];
    api.sessions = [{ id: 658, pc_id: 121, status: "active" }];
    await mount();
    expect(removeButton(121).disabled).toBe(true);
    expect(removeButton(121).title).toBe("A session is running on it. Finish the session first.");
    expect(screen.getByTestId("orphan-device-121").textContent).toContain("session running");
    expect(removeButton(108).disabled).toBe(false);
  });

  test("…nor one whose own status says a session runs, even if the sessions list missed it", async () => {
    api.pcs = [device(122, "№12", { status: "in_session" })];
    await mount();
    expect(removeButton(122).disabled).toBe(true);
  });

  test("the running sessions could not be read: nothing can be deleted (never 'nothing runs')", async () => {
    api.pcs = [device(108, "№5")];
    api.sessionsError = new Error("offline");
    await mount();
    // The read failed as a whole, so the notice is not even shown from half an answer.
    expect(screen.queryByTestId(`orphan-device-remove-108`)).toBeNull();
    expect(deletes()).toEqual([]);
  });

  test("confirm → exactly one DELETE /pcs/{id}, the parent is told, the list is read again", async () => {
    api.pcs = [device(108, "№5")];
    const onRemoved = await mount();
    await act(async () => { fireEvent.click(removeButton(108)); });
    const question = screen.getByRole("button", { name: "Confirm" }).closest(".card")?.textContent ?? "";
    expect(question).toContain("“№5”");
    expect(question).toContain("every session recorded on it is deleted");
    api.pcs = [];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm" })); });
    expect(deletes()).toEqual([{ path: "/pcs/108", method: "DELETE", params: undefined }]);
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("devices-without-place")).toBeNull();
  });

  test("cancel → nothing is deleted", async () => {
    api.pcs = [device(108, "№5")];
    await mount();
    await act(async () => { fireEvent.click(removeButton(108)); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
    expect(deletes()).toEqual([]);
  });

  test("without the right to lay out places: listed, no delete buttons", async () => {
    api.pcs = [device(108, "№5")];
    await mount(false);
    expect(screen.getByTestId("orphan-device-108")).toBeTruthy();
    expect(screen.queryByTestId("orphan-device-remove-108")).toBeNull();
  });
});
