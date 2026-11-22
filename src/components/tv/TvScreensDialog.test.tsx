// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ITvScreen } from "@/api/tvScreens";
import type { IBranchPlace } from "@/types/api";

/**
 * The branch's TVs (2026-11-23): pair by the code on the TV, move, unpair.
 * The dialog sends exactly what the owner chose and shows the server's
 * answer; it holds no rule of its own beyond "six digits and a place".
 */
const api = vi.hoisted(() => ({ list: vi.fn(), pair: vi.fn(), update: vi.fn(), unpair: vi.fn(), confirm: vi.fn() }));
vi.mock("@/api/tvScreens", async () => {
  const real = await vi.importActual<typeof import("@/api/tvScreens")>("@/api/tvScreens");
  return {
    ...real,
    apiListTvScreens: (...a: unknown[]) => api.list(...a),
    apiPairTvScreen: (...a: unknown[]) => api.pair(...a),
    apiUpdateTvScreen: (...a: unknown[]) => api.update(...a),
    apiUnpairTvScreen: (...a: unknown[]) => api.unpair(...a),
  };
});
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), lang: "ru" }) };
});
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div> }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => api.confirm }));

import TvScreensDialog from "./TvScreensDialog";

const places = [
  { id: 7, branch_id: 1, number: 7, name: null, platform: "ps5", type: "standard", status: "active" },
  { id: 8, branch_id: 1, number: 8, name: "Corner", platform: "ps5", type: "standard", status: "active" },
] as unknown as IBranchPlace[];

const tv = (over: Partial<ITvScreen> = {}): ITvScreen => ({
  id: 3, branch_id: 1, place_id: 7, place_name: null, place_number: 7, name: "TV 7",
  paired_at: "2026-11-23T01:00:00+04:00", last_seen_at: "2026-11-23T01:00:00+04:00", online: true, ...over,
});

const mount = async () => {
  await act(async () => { render(<TvScreensDialog branchId={1} places={places} onClose={() => {}} />); });
  await act(async () => { await Promise.resolve(); });
};

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.list.mockResolvedValue([]); });
afterEach(cleanup);

describe("TvScreensDialog", () => {
  test("lists the branch's TVs with their place and whether they are on", async () => {
    api.list.mockResolvedValue([tv(), tv({ id: 4, name: null, place_id: 8, online: false })]);
    await mount();
    expect(api.list).toHaveBeenCalledWith(1);
    const rows = screen.getAllByTestId("tv-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("TV 7");
    expect(rows[0].textContent).toContain("В сети");
    expect(rows[1].textContent).toContain("Телевизор");
    expect(rows[1].textContent).toContain("Не в сети");
    expect((rows[1].querySelector("select") as HTMLSelectElement).value).toBe("8");
  });

  test("pairs only with six digits and a place, sending exactly those", async () => {
    api.pair.mockResolvedValue(tv());
    await mount();
    const button = screen.getByTestId("tv-pair") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("tv-code"), { target: { value: "123 45" } });
    fireEvent.change(screen.getByTestId("tv-place"), { target: { value: "8" } });
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("tv-code"), { target: { value: "123 456" } });
    expect(button.disabled).toBe(false);
    await act(async () => { fireEvent.submit(screen.getByTestId("tv-pair-form")); });
    await flush();

    expect(api.pair).toHaveBeenCalledWith(1, { code: "123456", place_id: 8, name: null });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect((screen.getByTestId("tv-code") as HTMLInputElement).value).toBe("");
  });

  test("an unknown code is said in words, not as a server sentence", async () => {
    api.pair.mockRejectedValue(Object.assign(new Error("No TV shows this code."), { body: { code: "tv_code_unknown" } }));
    await mount();
    fireEvent.change(screen.getByTestId("tv-code"), { target: { value: "999999" } });
    fireEvent.change(screen.getByTestId("tv-place"), { target: { value: "7" } });
    await act(async () => { fireEvent.submit(screen.getByTestId("tv-pair-form")); });
    await flush();
    expect(screen.getByRole("alert").textContent).toContain("Ни один телевизор не показывает этот код");
  });

  test("moves a TV to another place", async () => {
    api.list.mockResolvedValue([tv()]);
    api.update.mockResolvedValue(tv({ place_id: 8 }));
    await mount();
    const select = screen.getByTestId("tv-row").querySelector("select") as HTMLSelectElement;
    await act(async () => { fireEvent.change(select, { target: { value: "8" } }); });
    await flush();
    expect(api.update).toHaveBeenCalledWith(3, { place_id: 8 });
  });

  test("unpairs only after the owner confirms", async () => {
    api.list.mockResolvedValue([tv()]);
    api.unpair.mockResolvedValue(null);
    await mount();

    api.confirm.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.click(screen.getByText("Отвязать")); });
    await flush();
    expect(api.unpair).not.toHaveBeenCalled();

    api.confirm.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByText("Отвязать")); });
    await flush();
    expect(api.unpair).toHaveBeenCalledWith(3);
  });

  describe("on the desktop, TVs found on the club network", () => {
    const g = globalThis as { cyberplaceTV?: unknown };
    afterEach(() => { delete g.cyberplaceTV; });

    test("are listed and paired by choosing a place, with no code to type", async () => {
      g.cyberplaceTV = { discover: vi.fn().mockResolvedValue([
        { address: "192.168.1.45", code: "654321", env: "staging", maker: "Sony", model: "BRAVIA 4K" },
      ]) };
      api.pair.mockResolvedValue(tv());
      await mount();
      await flush();
      const row = screen.getByTestId("tv-found");
      expect(row.textContent).toContain("Sony BRAVIA 4K");
      expect(row.textContent).toContain("192.168.1.45");
      const button = row.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);

      fireEvent.change(row.querySelector("select") as HTMLSelectElement, { target: { value: "8" } });
      expect(button.disabled).toBe(false);
      await act(async () => { fireEvent.click(button); });
      await flush();

      expect(api.pair).toHaveBeenCalledWith(1, { code: "654321", place_id: 8, name: "Sony BRAVIA 4K" });
      expect(screen.queryByTestId("tv-found")).toBeNull();
    });

    test("a refused pairing is said and the TV stays to try again", async () => {
      g.cyberplaceTV = { discover: vi.fn().mockResolvedValue([
        { address: "192.168.1.45", code: "654321", env: "staging", maker: "Sony", model: "BRAVIA 4K" },
      ]) };
      api.pair.mockRejectedValue(Object.assign(new Error("x"), { body: { code: "tv_code_unknown" } }));
      await mount();
      await flush();
      const row = screen.getByTestId("tv-found");
      fireEvent.change(row.querySelector("select") as HTMLSelectElement, { target: { value: "7" } });
      await act(async () => { fireEvent.click(row.querySelector("button") as HTMLButtonElement); });
      await flush();
      expect(screen.getByRole("alert").textContent).toContain("Ни один телевизор не показывает этот код");
      expect(screen.getByTestId("tv-found")).toBeTruthy();
    });

    test("nothing found says what to check", async () => {
      g.cyberplaceTV = { discover: vi.fn().mockResolvedValue([]) };
      await mount();
      await flush();
      expect(screen.getByTestId("tv-network-empty").textContent).toContain("в той же сети");
    });
  });

  test("in the owner web (no bridge) only the code form is offered", async () => {
    await mount();
    expect(screen.queryByTestId("tv-network")).toBeNull();
    expect(screen.getByTestId("tv-pair-form")).toBeTruthy();
  });
});

