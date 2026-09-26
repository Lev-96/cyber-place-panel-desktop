// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISessionEvent } from "@/api/sessions";
import type { ISessionApi } from "@/types/sessions";

/**
 * The History screen's cards, as a whole: every card's activity comes from the
 * ONE branch feed the page already loads, no card asks for more unless the feed
 * cannot vouch for it, and the old «show the path» toggle and the branch-wide
 * «what happened» list are gone — each event lives in its own session's card.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k === "history.showMore" ? "more {0}" : k),
    money: (n: number) => `${n} AMD`,
  }),
}));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const repo = vi.hoisted(() => ({
  list: vi.fn(),
  listEvents: vi.fn(),
  eventsForSession: vi.fn(),
}));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    list: (...a: unknown[]) => repo.list(...a),
    listEvents: (...a: unknown[]) => repo.listEvents(...a),
    eventsForSession: (...a: unknown[]) => repo.eventsForSession(...a),
  },
}));

import SessionsHistory from "./SessionsHistory";

const today = new Date();
today.setHours(12, 0, 0, 0);
const iso = (minutesFromNoon: number) => new Date(today.getTime() + minutesFromNoon * 60_000).toISOString();
const tomorrow = new Date(today.getTime() + 24 * 3600_000).toISOString();

const session = (id: number, over: Partial<ISessionApi> = {}): ISessionApi => ({
  id,
  pc_id: id,
  pc_label: `№${id}`,
  status: "stopped",
  mode: "open",
  started_at: iso(0),
  stopped_at: iso(60),
  ends_at: iso(60),
  total_paid: 1003,
  items: [],
  payment_method: "cash",
  opened_by: { id: 1, name: "Giorgi Beridze" },
  stopped_by: { id: 1, name: "Giorgi Beridze" },
  branch: { id: 1, company_name: "NextLevel Esports", address: "Azatutyan Avenue" },
  ...over,
} as unknown as ISessionApi);

const event = (id: number, session_id: number, action: ISessionEvent["action"], minute: number, amount: number | null = null): ISessionEvent => ({
  id, session_id, branch_id: 1, action, amount, meta: { place_number: session_id }, created_at: iso(minute),
  user: { id: 1, name: "Giorgi Beridze", role: "manager" },
});

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/1/sessions/history"]}>
        <Routes>
          <Route path="/branches/:branchId/sessions/history" element={<SessionsHistory />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
};

const cardOf = (label: string) => [...document.querySelectorAll(".hs-card")]
  .find((c) => c.querySelector("strong")?.textContent === label) as HTMLElement;
const titlesIn = (card: HTMLElement) => [...card.querySelectorAll(".hs-event__title")].map((n) => n.textContent);

beforeEach(() => {
  repo.list.mockReset();
  repo.listEvents.mockReset();
  repo.eventsForSession.mockReset();
  repo.eventsForSession.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("SessionsHistory — the cards", () => {
  test("one feed request for the whole page; each card shows its own events and no other's", async () => {
    repo.list.mockResolvedValue([session(8), session(9)]);
    repo.listEvents.mockResolvedValue([
      event(4, 9, "stopped", 60, 1003), event(3, 8, "stopped", 30, 500),
      event(2, 9, "started", 0, 0), event(1, 8, "started", 0, 0),
    ]);
    await mount();

    expect(repo.listEvents).toHaveBeenCalledTimes(1);
    expect(repo.listEvents.mock.calls[0][0]).toMatchObject({ branch_id: 1, limit: 1000 });
    expect(repo.eventsForSession).not.toHaveBeenCalled();
    expect(titlesIn(cardOf("№8"))).toEqual(["history.action.started", "history.action.stopped"]);
    expect([...cardOf("№9").querySelectorAll(".hs-event__amount")].map((n) => n.textContent)).toEqual(["0 AMD", "1003 AMD"]);
  });

  test("the old toggle and the branch-wide list are gone", async () => {
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValue([event(1, 8, "started", 0, 0)]);
    await mount();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("history.timelineShow");
    expect(text).not.toContain("history.timelineHide");
    expect(text).not.toContain("history.actions");
  });

  test("the facts and the bill keep what the card always said", async () => {
    repo.list.mockResolvedValue([session(8, { total_paid: 1003, payment_method: "card" } as Partial<ISessionApi>)]);
    repo.listEvents.mockResolvedValue([event(1, 8, "started", 0, 0)]);
    await mount();
    const card = cardOf("№8");
    const facts = [...card.querySelectorAll(".hs-facts dt")].map((n) => n.textContent);
    expect(facts).toEqual(["history.timeLabel", "history.startedBy", "history.endedBy", "history.branch"]);
    expect(card.textContent).toContain("NextLevel Esports, Azatutyan Avenue");
    expect(card.textContent).toContain("session.payCard");
    expect(card.textContent).toContain("1003 AMD");
  });

  test("a session that ran past the range fetches its own events — and only it", async () => {
    repo.list.mockResolvedValue([session(8), session(9, { stopped_at: tomorrow, ends_at: tomorrow } as Partial<ISessionApi>)]);
    repo.listEvents.mockResolvedValue([event(2, 9, "started", 0, 0), event(1, 8, "started", 0, 0)]);
    repo.eventsForSession.mockResolvedValue([event(2, 9, "started", 0, 0), event(3, 9, "stopped", 24 * 60, 900)]);
    await mount();

    expect(repo.eventsForSession).toHaveBeenCalledTimes(1);
    expect(repo.eventsForSession).toHaveBeenCalledWith(9);
    expect(titlesIn(cardOf("№9"))).toEqual(["history.action.started", "history.action.stopped"]);
  });

  test("from a feed cut at its limit, a card whose start was cut off fetches its own", async () => {
    const filler = Array.from({ length: 1000 }, (_, i) => event(5000 - i, 8, "paused", 1));
    repo.list.mockResolvedValue([session(8), session(9)]);
    repo.listEvents.mockResolvedValue([...filler.slice(0, 998), event(10, 8, "started", 0, 0), event(9, 9, "stopped", 60, 100)]);
    await mount();
    expect(repo.eventsForSession).toHaveBeenCalledTimes(1);
    expect(repo.eventsForSession).toHaveBeenCalledWith(9);
  });

  test("showing more of a long history asks the server nothing", async () => {
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValue(Array.from({ length: 12 }, (_, i) => event(20 - i, 8, i === 11 ? "started" : "paused", 11 - i)));
    await mount();
    const calls = repo.list.mock.calls.length + repo.listEvents.mock.calls.length;

    const more = screen.getByRole("button", { name: "more 7" });
    await act(async () => { fireEvent.click(more); });
    expect(titlesIn(cardOf("№8"))).toHaveLength(12);
    expect(repo.list.mock.calls.length + repo.listEvents.mock.calls.length).toBe(calls);
    expect(repo.eventsForSession).not.toHaveBeenCalled();
  });

  test("a session that moved names the seats it was played on", async () => {
    const move: ISessionEvent = {
      ...event(2, 8, "moved", 10),
      meta: { place_number: 9, from_place_number: 9, to_place_number: 14 },
    };
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValue([event(3, 8, "stopped", 20, 10), move, { ...event(1, 8, "started", 0, 0), meta: { place_number: 9 } }]);
    await mount();
    const card = cardOf("№8");
    const dts = [...card.querySelectorAll(".hs-facts dt")];
    const seats = dts.find((d) => d.textContent === "history.seatsLabel")?.nextElementSibling?.textContent;
    expect(seats).toBe("№9 → №14");
  });
});

describe("SessionsHistory — refresh", () => {
  test("Refresh re-reads the events as well as the sessions, so a card never tells an old story", async () => {
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValueOnce([event(1, 8, "started", 0, 0)])
      .mockResolvedValue([event(2, 8, "stopped", 60, 1003), event(1, 8, "started", 0, 0)]);
    await mount();
    expect(titlesIn(cardOf("№8"))).toEqual(["history.action.started"]);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.refresh" })); });
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });

    expect(repo.listEvents).toHaveBeenCalledTimes(2);
    expect(titlesIn(cardOf("№8"))).toEqual(["history.action.started", "history.action.stopped"]);
  });
});
