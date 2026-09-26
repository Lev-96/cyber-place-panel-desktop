// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ISessionEvent } from "@/api/sessions";
import SessionHistoryTimeline from "./SessionHistoryTimeline";

/**
 * One session's activity inside its card: every event once, readable top-down,
 * a long history folded behind one real button that never fetches anything.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k === "history.showMore" ? "more {0}" : k),
    money: (n: number) => `${n} AMD`,
  }),
}));

const START = "2026-09-26T12:56:00+04:00";
const at = (min: number) => new Date(new Date(START).getTime() + min * 60_000).toISOString();
const who = { id: 1, name: "Giorgi Beridze", role: "manager" };

const event = (id: number, over: Partial<ISessionEvent> = {}): ISessionEvent => ({
  id, session_id: 9, branch_id: 1, action: "paused", amount: null, meta: null, created_at: at(id), user: who, ...over,
});

/** The example from the brief: start, a sale, a pause, the automatic resume, a move, the stop. */
const EVENING: ISessionEvent[] = [
  event(1, { action: "started", amount: 0, meta: { place_number: 9 } }),
  event(2, { action: "item_added", amount: 3000, meta: { count: 5, place_number: 9, lines: [{ name: "Cola 0.5L", price: 600, qty: 5 }] } }),
  event(3, { action: "paused", meta: { place_number: 9 } }),
  event(4, { action: "resumed", user: null, meta: { reason: "pause_limit", paused_seconds: 60, place_number: 9 } }),
  event(5, {
    action: "moved",
    meta: { reason: "relocation", from_place_number: 9, to_place_number: 14, played_minutes_before: 0, total_before: 3012, rate_before: 1000, rate_after: 1500, place_number: 9 },
  }),
  event(6, { action: "stopped", amount: 3019, meta: { place_number: 14 } }),
];

const mount = (events: ISessionEvent[] | null) => render(<SessionHistoryTimeline events={events} startedAt={START} />);
const titles = () => [...document.querySelectorAll(".hs-event__title")].map((n) => n.textContent);
const moreButton = () => screen.queryByRole("button");

afterEach(() => cleanup());

describe("SessionHistoryTimeline", () => {
  test("a short history shows every event, oldest first, with no button", () => {
    mount([...EVENING].reverse());
    expect(titles()).toEqual([
      "history.action.started",
      "history.action.item_added",
      "history.action.paused",
      "history.autoResumeTitle",
      "history.action.moved",
      "history.action.stopped",
    ]);
    expect(moreButton()).toBeNull();
    expect(document.body.textContent).not.toContain("history.timelineShow");
  });

  test("each event reads as time, title, actor, one detail per line, amount", () => {
    mount(EVENING);
    const sale = document.querySelectorAll(".hs-event")[1];
    expect(sale.querySelector("time")?.getAttribute("dateTime")).toBe(at(2));
    expect(sale.querySelector(".hs-event__actor")?.textContent).toBe("Giorgi Beridze");
    expect([...sale.querySelectorAll(".hs-event__detail")].map((n) => n.textContent))
      .toEqual(["history.itemsCount: 5", "Cola 0.5L × 5"]);
    expect(sale.querySelector(".hs-event__amount")?.textContent).toBe("3000 AMD");
  });

  test("the automatic resume says who (nobody), why and for how long — and looks different", () => {
    mount(EVENING);
    const auto = document.querySelectorAll(".hs-event")[3];
    expect(auto.classList.contains("hs-tone-auto")).toBe(true);
    expect(auto.querySelector(".hs-event__actor")?.textContent).toBe("history.endedAutomatically");
    expect([...auto.querySelectorAll(".hs-event__detail")].map((n) => n.textContent))
      .toEqual(["history.pauseLimitReason", "history.pausedFor: 1 time.minShort"]);
  });

  test("a move is its own event with each fact on a line, and the seats open their stretches", () => {
    mount(EVENING);
    const move = document.querySelectorAll(".hs-event")[4];
    expect([...move.querySelectorAll(".hs-event__detail")].map((n) => n.textContent)).toEqual([
      "№9 -> №14",
      "history.playedBeforeMove: 0 time.minShort",
      "history.totalBeforeMove: 3012 AMD",
      "1000 AMD / time.hourShort -> 1500 AMD / time.hourShort",
    ]);
    expect([...document.querySelectorAll(".hs-seat__chip")].map((n) => n.textContent)).toEqual(["№9", "№14"]);
  });

  test("a session that never moved has no seat chips", () => {
    mount(EVENING.slice(0, 3));
    expect(document.querySelectorAll(".hs-seat")).toHaveLength(0);
  });

  test("a long history folds its middle: start and finish stay, the button counts the rest", () => {
    const long = Array.from({ length: 20 }, (_, i) => event(i + 1, { action: i === 0 ? "started" : i === 19 ? "stopped" : "paused" }));
    mount(long);
    expect(titles()).toHaveLength(5);
    expect(titles()[0]).toBe("history.action.started");
    expect(titles().at(-1)).toBe("history.action.stopped");
    expect(document.querySelectorAll(".hs-gap")).toHaveLength(1);
    const button = moreButton()!;
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("more 15");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(document.querySelector(".hs-timeline")!.id);
  });

  test("the button shows the rest, then folds it again — and keeps the focus both times", () => {
    const long = Array.from({ length: 10 }, (_, i) => event(i + 1));
    mount(long);
    const button = moreButton()!;
    act(() => { button.focus(); });
    act(() => { fireEvent.click(button); });
    expect(titles()).toHaveLength(10);
    expect(document.querySelectorAll(".hs-revealed")).toHaveLength(5);
    expect(document.querySelectorAll(".hs-gap")).toHaveLength(0);
    expect(button.textContent).toBe("history.collapse");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(button);

    act(() => { fireEvent.click(button); });
    expect(titles()).toHaveLength(5);
    expect(document.activeElement).toBe(button);
  });

  test("the button works from the keyboard: it is a real button", () => {
    mount(Array.from({ length: 9 }, (_, i) => event(i + 1)));
    const button = moreButton()! as HTMLButtonElement;
    expect(button.type).toBe("button");
    // A native button turns Enter/Space into a click; the click is what we handle.
    act(() => { button.click(); });
    expect(titles()).toHaveLength(9);
  });

  test("exactly at the fold limit nothing is hidden", () => {
    mount(Array.from({ length: 7 }, (_, i) => event(i + 1)));
    expect(titles()).toHaveLength(7);
    expect(moreButton()).toBeNull();
  });

  test("a single event, no events, and still loading each read plainly", () => {
    mount([event(1, { action: "started" })]);
    expect(titles()).toEqual(["history.action.started"]);
    cleanup();
    mount([]);
    expect(document.body.textContent).toBe("history.actionsEmpty");
    cleanup();
    mount(null);
    expect(document.body.textContent).toBe("history.timelineLoading");
  });

  test("an event with no actor and no meta still renders its title and time", () => {
    mount([event(1, { action: "stopped", user: null, amount: 1003 })]);
    expect(document.querySelector(".hs-event__actor")).toBeNull();
    expect(document.querySelector(".hs-event__detail")).toBeNull();
    expect(document.querySelector(".hs-event__amount")?.textContent).toBe("1003 AMD");
  });

  test("an action the panel does not know still renders, with what its meta says", () => {
    mount([event(1, { action: "ps_woke" as ISessionEvent["action"], meta: { console: "PS5-01" } })]);
    expect(titles()).toEqual(["history.action.ps_woke"]);
    expect(document.querySelector(".hs-event__detail")?.textContent).toBe("Console: PS5-01");
  });

  test("an event on another day than the start carries its date", () => {
    mount([event(1, { action: "started" }), event(2, { action: "stopped", created_at: "2026-09-27T01:10:00+04:00" })]);
    const times = [...document.querySelectorAll("time")].map((n) => n.textContent ?? "");
    expect(times[0]).not.toMatch(/2026/);
    expect(times[1]).toMatch(/27/);
  });
});
