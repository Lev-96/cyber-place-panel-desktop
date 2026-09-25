// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionCard from "./SessionCard";

/**
 * The frame says "act now" as well as the digits: amber in the last five
 * minutes, red in the last one, muted while paused, dashed when the device is
 * offline. The seat's own colour otherwise.
 */

const running = (endsInMs: number | null, over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 1, status: "active", paused_at: null,
  ends_at: endsInMs === null ? null : new Date(Date.now() + endsInMs).toISOString(),
  ...over,
} as ISessionApi);

const card = (props: Partial<Parameters<typeof SessionCard>[0]> = {}) => {
  render(<SessionCard baseColor="#22c55e" seatState="busy" {...props}><span>body</span></SessionCard>);
  return document.querySelector(".place-cell") as HTMLElement;
};

afterEach(cleanup);

describe("SessionCard frame", () => {
  test.each([
    ["30 min left", running(30 * 60_000), "session-card--running", "#22c55e"],
    ["3 min left", running(3 * 60_000), "session-card--warn", "var(--color-warning)"],
    ["30 s left", running(30_000), "session-card--crit", "var(--color-danger)"],
    ["paused", running(60_000, { paused_at: new Date().toISOString() }), "session-card--paused", "var(--color-muted)"],
    ["open (no end)", running(null), "session-card--running", "#22c55e"],
  ])("%s", (_label, session, cls, accent) => {
    const el = card({ session });
    expect(el.classList.contains(cls)).toBe(true);
    expect(el.style.getPropertyValue("--card-accent")).toBe(accent);
    expect(el.classList.contains("session-card")).toBe(true);
  });

  test("a free seat keeps its own colour and is idle", () => {
    const el = card({ baseColor: "#1f2a44", seatState: "free" });
    expect(el.classList.contains("session-card--idle")).toBe(true);
    expect(el.classList.contains("session-card--seat-free")).toBe(true);
    expect(el.style.getPropertyValue("--card-accent")).toBe("#1f2a44");
    expect([...el.classList].some((c) => /--(warn|crit|paused)$/.test(c))).toBe(false);
  });

  test("offline and drag states are classes the board and its CSS rely on", () => {
    const el = card({ seatState: "offline", dragging: true, dropBefore: true });
    expect(el.classList.contains("session-card--seat-offline")).toBe(true);
    expect(el.classList.contains("is-dragging")).toBe(true);
    expect(el.classList.contains("is-drop-before")).toBe(true);
  });
});
