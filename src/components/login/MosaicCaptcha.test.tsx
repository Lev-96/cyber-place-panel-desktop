// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The sign-in mosaic (2026-10-07), driven down to the transport: tiles swap
 * by two taps or by the keyboard, "Check" sends the order once, the right
 * answer plays its moment then hands the pass on, a wrong one shakes and
 * brings a new picture, "New picture" tells the server to forget the old
 * one, and a failed load says so with a way to retry.
 */

interface Call { path: string; method: string; body?: unknown }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body?: unknown }>,
  handler: (_c: { path: string; method: string; body?: unknown }): Promise<unknown> => Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    api.calls.push(call);
    return api.handler(call);
  },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});

import MosaicCaptcha from "./MosaicCaptcha";

let n = 0;
const challenge = () => ({ id: `c${++n}`, image: "data:image/jpeg;base64,AAAA", grid: 3, size: 360 });
const apiError = (status: number, body: unknown) => Object.assign(new Error("x"), { status, body });
let verify: (c: Call) => Promise<unknown>;
let getChallenge: () => Promise<unknown>;

const reduced = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  api.calls = [];
  n = 0;
  reduced(false);
  getChallenge = async () => challenge();
  verify = async () => ({ captcha_token: "pass-1" });
  api.handler = async (c: Call) => {
    if (c.path.startsWith("/auth/captcha") && c.method === "GET") return getChallenge();
    if (c.path.startsWith("/auth/captcha") && c.method === "POST") return verify(c);
    throw new Error(`unexpected ${c.method} ${c.path}`);
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const tiles = () => screen.getAllByRole("button", { name: /^Piece / });
const gets = () => api.calls.filter((c) => c.method === "GET");
const posts = () => api.calls.filter((c) => c.method === "POST");

describe("the mosaic", () => {
  test("loads a picture for its own client and shows nine pieces", async () => {
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));
    expect(gets()[0].path).toBe("/auth/captcha?client=desktop");
    expect(screen.getByRole("group", { name: "Confirm you are a person" })).toBeTruthy();
  });

  test("shows the picture under React's StrictMode too (mounted, unmounted, mounted again)", async () => {
    render(<StrictMode><MosaicCaptcha client="desktop" onSolved={() => {}} /></StrictMode>);
    await waitFor(() => expect(tiles()).toHaveLength(9));
  });

  test("two taps swap two pieces, and Check sends the order once", async () => {
    render(<MosaicCaptcha client="owner_web" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));

    fireEvent.click(tiles()[0]);
    expect(tiles()[0].getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Now tap the piece to swap it with.");
    fireEvent.click(tiles()[4]);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });

    expect(posts()).toEqual([{ path: "/auth/captcha?client=owner_web", method: "POST", body: { id: "c1", order: [4, 1, 2, 3, 0, 5, 6, 7, 8] } }]);
  });

  test("the keyboard does it too: arrows move, Enter picks and swaps", async () => {
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));

    tiles()[0].focus();
    fireEvent.keyDown(tiles()[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tiles()[1]);
    fireEvent.keyDown(tiles()[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(tiles()[4]);
    // Native buttons turn Enter/Space into a click.
    fireEvent.click(tiles()[4]);
    fireEvent.keyDown(tiles()[4], { key: "ArrowLeft" });
    fireEvent.click(tiles()[3]);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });
    expect((posts()[0].body as { order: number[] }).order).toEqual([0, 1, 2, 4, 3, 5, 6, 7, 8]);
  });

  test("the right answer plays its moment, then hands the pass on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSolved = vi.fn();
    render(<MosaicCaptcha client="desktop" onSolved={onSolved} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });
    expect(screen.getByRole("status").textContent).toBe("Done. Signing you in…");
    expect(onSolved).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(700); });
    expect(onSolved).toHaveBeenCalledWith("pass-1");
  });

  test("under reduced motion the pass is handed on at once", async () => {
    reduced(true);
    const onSolved = vi.fn();
    render(<MosaicCaptcha client="desktop" onSolved={onSolved} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });
    await waitFor(() => expect(onSolved).toHaveBeenCalledWith("pass-1"));
  });

  test("a wrong answer shakes, says so, and brings a new picture without being asked", async () => {
    verify = () => Promise.reject(apiError(422, { code: "captcha_failed" }));
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });
    expect(document.querySelector(".mosaic__board.is-wrong")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("The mosaic is not put together right. Here is a new picture, try again.");

    await waitFor(() => expect(gets()).toHaveLength(2));
    // The spent picture is not "replaced": the server already forgot it.
    expect(gets()[1].path).toBe("/auth/captcha?client=desktop");
    await waitFor(() => expect(tiles()).toHaveLength(9));
  });

  test("New picture tells the server to forget the one on screen", async () => {
    render(<MosaicCaptcha client="owner_web" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));
    fireEvent.click(tiles()[0]);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "New picture" })); });

    expect(gets()[1].path).toBe("/auth/captcha?client=owner_web&replaces=c1");
    await waitFor(() => expect(tiles()).toHaveLength(9));
    // What was picked on the old picture does not carry over.
    expect(tiles().every((el) => el.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  test("New picture is off while one is loading, so it cannot be asked for twice", async () => {
    let release!: () => void;
    getChallenge = () => new Promise((resolve) => { release = () => resolve(challenge()); });
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);

    const refresh = screen.getByRole("button", { name: "New picture" }) as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    fireEvent.click(refresh);
    expect(gets()).toHaveLength(1);

    await act(async () => { release(); });
    await waitFor(() => expect(tiles()).toHaveLength(9));
  });

  test("New picture pressed during the wrong-answer shake still loads only one picture", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let release!: () => void;
    verify = () => Promise.reject(apiError(422, { code: "captcha_failed" }));
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));
    getChallenge = () => new Promise((resolve) => { release = () => resolve(challenge()); });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });
    // The shake is playing; the person asks for a new picture right now.
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "New picture" })); });
    await act(async () => { vi.advanceTimersByTime(600); });

    expect(gets()).toHaveLength(2);
    await act(async () => { release(); });
  });

  test("a picture that does not load says so, and Try again loads one", async () => {
    getChallenge = () => Promise.reject(apiError(500, { message: "boom" }));
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);

    expect(await screen.findByText("The picture did not load. Check the connection and try again.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Check" }) as HTMLButtonElement).disabled).toBe(true);

    getChallenge = async () => challenge();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    await waitFor(() => expect(tiles()).toHaveLength(9));
  });

  test("a network failure on Check is not called a wrong mosaic", async () => {
    verify = () => Promise.reject(new Error("Failed to fetch"));
    render(<MosaicCaptcha client="desktop" onSolved={() => {}} />);
    await waitFor(() => expect(tiles()).toHaveLength(9));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check" })); });
    expect(screen.getByRole("status").textContent).toBe("The picture did not load. Check the connection and try again.");
  });
});
