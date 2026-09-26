// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
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
  listEventActors: vi.fn(),
}));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    list: (...a: unknown[]) => repo.list(...a),
    listEvents: (...a: unknown[]) => repo.listEvents(...a),
    eventsForSession: (...a: unknown[]) => repo.eventsForSession(...a),
    listEventActors: (...a: unknown[]) => repo.listEventActors(...a),
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

/** Lets a test open another branch the way the app does — by route. */
const nav = { go: (_to: string) => {} };
const NavProbe = () => {
  const navigate = useNavigate();
  nav.go = navigate;
  return null;
};

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/1/sessions/history"]}>
        <NavProbe />
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
  repo.listEventActors.mockReset();
  repo.listEventActors.mockResolvedValue([]);
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
    // Facts, then what happened, then the bill as its outcome.
    const order = [...card.children].map((c) => c.className.split(" ")[0]);
    expect(order.indexOf("hs-facts")).toBeLessThan(order.indexOf("hs-activity"));
    expect(order.indexOf("hs-activity")).toBeLessThan(order.indexOf("hs-bill"));
  });

  test("a session that ran past the range fetches its own events — and only it", async () => {
    repo.list.mockResolvedValue([session(8), session(9, { stopped_at: tomorrow, ends_at: tomorrow } as Partial<ISessionApi>)]);
    repo.listEvents.mockResolvedValue([event(2, 9, "started", 0, 0), event(1, 8, "started", 0, 0)]);
    repo.eventsForSession.mockResolvedValue([event(2, 9, "started", 0, 0), event(3, 9, "stopped", 24 * 60, 900)]);
    await mount();

    expect(repo.eventsForSession).toHaveBeenCalledTimes(1);
    expect(repo.eventsForSession).toHaveBeenCalledWith(9, undefined);
    expect(titlesIn(cardOf("№9"))).toEqual(["history.action.started", "history.action.stopped"]);
  });

  test("from a feed cut at its limit, a card whose start was cut off fetches its own", async () => {
    const filler = Array.from({ length: 1000 }, (_, i) => event(5000 - i, 8, "paused", 1));
    repo.list.mockResolvedValue([session(8), session(9)]);
    repo.listEvents.mockResolvedValue([...filler.slice(0, 998), event(10, 8, "started", 0, 0), event(9, 9, "stopped", 60, 100)]);
    await mount();
    expect(repo.eventsForSession).toHaveBeenCalledTimes(1);
    expect(repo.eventsForSession).toHaveBeenCalledWith(9, undefined);
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
    // Each line froze the seat it was written on, as the server does.
    repo.listEvents.mockResolvedValue([
      { ...event(3, 8, "stopped", 20, 10), meta: { place_number: 14 } },
      move,
      { ...event(1, 8, "started", 0, 0), meta: { place_number: 9 } },
    ]);
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

describe("SessionsHistory — the timeline's own scroll", () => {
  test("the line sits in its own keyboard-reachable region; nothing else is a scroller", async () => {
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValue([event(2, 8, "stopped", 60, 1003), event(1, 8, "started", 0, 0)]);
    await mount();
    const region = screen.getByRole("region", { name: "history.activityLabel" });
    expect(region.classList.contains("hs-scroll")).toBe(true);
    expect(region.tabIndex).toBe(0);
    expect(region.querySelector("ol.hs-timeline")).toBeTruthy();
    // The card and the list carry no scroll of their own.
    expect(cardOf("№8").classList.contains("hs-scroll")).toBe(false);
    expect(document.querySelectorAll(".hs-scroll")).toHaveLength(1);
  });
});

describe("SessionsHistory — whose actions", () => {
  const anna = { id: 11, name: "Anna", role: "manager" };
  const zed = { id: 12, name: "Zed", role: "company_owner" };
  const by = (e: ISessionEvent, who: { id: number; name: string } | null): ISessionEvent =>
    ({ ...e, user: who === null ? null : { id: who.id, name: who.name, role: "manager" } });
  const select = () => screen.getByLabelText("history.actorLabel") as HTMLSelectElement;
  const pick = async (value: string) => {
    await act(async () => { fireEvent.change(select(), { target: { value } }); });
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
  };
  const lastFeedCall = () => repo.listEvents.mock.calls.at(-1)![0] as Record<string, unknown>;

  test("the choices are the server's list for this branch, after «all staff»", async () => {
    repo.listEventActors.mockResolvedValue([anna, zed]);
    repo.list.mockResolvedValue([]);
    repo.listEvents.mockResolvedValue([]);
    await mount();

    expect(repo.listEventActors).toHaveBeenCalledWith(1);
    expect([...select().options].map((o) => o.textContent)).toEqual([
      "history.actorAll", "Anna · role.manager", "Zed · role.company_owner",
    ]);
    expect(select().value).toBe("");
    expect(lastFeedCall()).not.toHaveProperty("user_id");
  });

  test("picking someone asks the SERVER for their lines, and shows only the sessions they acted in", async () => {
    repo.listEventActors.mockResolvedValue([anna, zed]);
    repo.list.mockResolvedValue([session(8), session(9)]);
    repo.listEvents
      .mockResolvedValueOnce([event(4, 9, "stopped", 60, 1), event(3, 8, "stopped", 30, 1), event(2, 9, "started", 0, 0), event(1, 8, "started", 0, 0)])
      .mockResolvedValue([by(event(3, 8, "stopped", 30, 1), anna)]);
    await mount();
    expect(document.querySelectorAll(".hs-card")).toHaveLength(2);

    await pick("11");
    expect(lastFeedCall()).toMatchObject({ branch_id: 1, user_id: 11, limit: 1000 });
    expect(document.querySelectorAll(".hs-card")).toHaveLength(1);
    expect(titlesIn(cardOf("№8"))).toEqual(["history.action.stopped"]);
  });

  test("«all staff» brings the whole screen back, with no author in the request", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([session(8), session(9)]);
    const all = [event(2, 9, "started", 0, 0), event(1, 8, "started", 0, 0)];
    repo.listEvents.mockResolvedValueOnce(all).mockResolvedValueOnce([by(event(1, 8, "started", 0, 0), anna)]).mockResolvedValue(all);
    await mount();
    await pick("11");
    expect(document.querySelectorAll(".hs-card")).toHaveLength(1);

    await pick("");
    expect(lastFeedCall()).not.toHaveProperty("user_id");
    expect(document.querySelectorAll(".hs-card")).toHaveLength(2);
  });

  test("nobody's actions in the period says so", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValueOnce([event(1, 8, "started", 0, 0)]).mockResolvedValue([]);
    await mount();
    await pick("11");
    expect(document.querySelectorAll(".hs-card")).toHaveLength(0);
    expect(document.body.textContent).toContain("history.noActions");
  });

  test("while a new person's lines load, the previous cards are not shown under their name", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([session(8)]);
    repo.listEvents.mockResolvedValueOnce([event(1, 8, "started", 0, 0)]).mockReturnValue(new Promise(() => {}));
    await mount();
    await pick("11");
    expect(document.querySelectorAll(".hs-card")).toHaveLength(0);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  test("a card fetched on its own keeps only that person's lines — the system's are nobody's", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([session(9, { stopped_at: tomorrow, ends_at: tomorrow } as Partial<ISessionApi>)]);
    repo.listEvents.mockResolvedValue([by(event(2, 9, "started", 0, 0), anna)]);
    repo.eventsForSession.mockResolvedValue([
      by(event(2, 9, "started", 0, 0), anna),
      by(event(3, 9, "resumed", 5), null),
      by(event(4, 9, "stopped", 24 * 60, 900), zed),
    ]);
    await mount();
    await pick("11");

    expect(repo.eventsForSession).toHaveBeenCalledWith(9, 11);
    expect(titlesIn(cardOf("№9"))).toEqual(["history.action.started"]);
  });

  test("a card fetched on its own with nothing of theirs is not shown", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([session(9, { stopped_at: tomorrow, ends_at: tomorrow } as Partial<ISessionApi>)]);
    repo.listEvents.mockResolvedValue([]);
    repo.eventsForSession.mockResolvedValue([by(event(4, 9, "stopped", 24 * 60, 900), zed)]);
    await mount();
    await pick("11");
    expect(document.querySelectorAll(".hs-card")).toHaveLength(0);
  });

  test("with one person's lines the card does not claim a seat route from them", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([session(8)]);
    const annas = [
      by({ ...event(1, 8, "started", 0, 0), meta: { place_number: 9 } }, anna),
      by({ ...event(3, 8, "stopped", 20, 10), meta: { place_number: 14 } }, anna),
    ];
    repo.listEvents.mockResolvedValue(annas);
    await mount();
    await pick("11");
    const dts = [...cardOf("№8").querySelectorAll(".hs-facts dt")].map((d) => d.textContent);
    expect(dts).not.toContain("history.seatsLabel");
    // The steps still say where each of her actions happened.
    expect([...cardOf("№8").querySelectorAll(".hs-seat__chip")].map((c) => c.textContent)).toEqual(["№9", "№14"]);
  });

  test("a manager picking the owner gets the sessions the owner acted in — even shifts the manager did not open", async () => {
    repo.listEventActors.mockResolvedValue([anna, zed]);
    // The manager's own list: only their shift (the server's own-shift rule).
    const mine = session(8);
    // A colleague's shift the owner stepped into — only the owner-filtered list has it.
    const colleagues = session(9);
    repo.list.mockImplementation(async (p: Record<string, unknown>) => (p.acted_by === 12 ? [colleagues] : [mine]));
    repo.listEvents.mockImplementation(async (p: Record<string, unknown>) =>
      (p.user_id === 12 ? [by(event(5, 9, "stopped", 60, 900), zed)] : [event(1, 8, "started", 0, 0)]));
    await mount();
    expect(titlesIn(cardOf("№8"))).toEqual(["history.action.started"]);

    await pick("12");
    const actedCall = repo.list.mock.calls.map((c) => c[0] as Record<string, unknown>).find((p) => p.acted_by === 12);
    expect(actedCall).toMatchObject({ branch_id: 1, acted_by: 12, limit: 1000 });
    expect(cardOf("№9")).toBeTruthy();
    expect(cardOf("№8")).toBeUndefined();
    expect(titlesIn(cardOf("№9"))).toEqual(["history.action.stopped"]);
    // The day's tiles still come from the list as it always was.
    expect(repo.list.mock.calls.some((c) => (c[0] as Record<string, unknown>).acted_by === undefined)).toBe(true);

    // «All staff» brings the manager's own list back.
    await pick("");
    expect(cardOf("№8")).toBeTruthy();
    expect(cardOf("№9")).toBeUndefined();
  });

  test("while the person's sessions are still loading, no card is shown under their name", async () => {
    repo.listEventActors.mockResolvedValue([zed]);
    repo.list.mockImplementation((p: Record<string, unknown>) => (p.acted_by === 12 ? new Promise(() => {}) : Promise.resolve([session(8)])));
    repo.listEvents.mockResolvedValue([event(1, 8, "started", 0, 0)]);
    await mount();
    await pick("12");
    expect(document.querySelectorAll(".hs-card")).toHaveLength(0);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  test("Refresh re-reads the person's sessions too", async () => {
    repo.listEventActors.mockResolvedValue([zed]);
    repo.list.mockResolvedValue([]);
    repo.listEvents.mockResolvedValue([]);
    await mount();
    await pick("12");
    const before = repo.list.mock.calls.filter((c) => (c[0] as Record<string, unknown>).acted_by === 12).length;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.refresh" })); });
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
    expect(repo.list.mock.calls.filter((c) => (c[0] as Record<string, unknown>).acted_by === 12).length).toBe(before + 1);
  });

  test("the person and the dates narrow together", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([]);
    repo.listEvents.mockResolvedValue([]);
    await mount();
    await pick("11");
    await act(async () => { fireEvent.click(screen.getByText("history.yesterday")); });
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });

    const call = lastFeedCall();
    expect(call.user_id).toBe(11);
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    expect(call.from).toBe(yesterdayStart.toISOString());
  });

  test("another branch starts from «all staff» and its own list of people", async () => {
    repo.listEventActors.mockResolvedValue([anna]);
    repo.list.mockResolvedValue([]);
    repo.listEvents.mockResolvedValue([]);
    await mount();
    await pick("11");
    expect(lastFeedCall().user_id).toBe(11);

    await act(async () => { nav.go("/branches/2/sessions/history"); });
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });

    expect(repo.listEventActors).toHaveBeenLastCalledWith(2);
    expect(lastFeedCall()).toMatchObject({ branch_id: 2 });
    expect(lastFeedCall()).not.toHaveProperty("user_id");
    expect(select().value).toBe("");
  });
});
