// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionCard, { CardOverflow, SessionCardAction } from "./SessionCard";
import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

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
    ["3 min left", running(3 * 60_000), "session-card--warn", "rgb(var(--status-ending-rgb))"],
    ["30 s left", running(30_000), "session-card--crit", "rgb(var(--status-critical-rgb))"],
    ["paused", running(60_000, { paused_at: new Date().toISOString() }), "session-card--paused", "rgb(var(--status-offline-rgb))"],
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
    const el = card({ seatState: "offline", dragging: true, dropSide: "before" });
    expect(el.classList.contains("session-card--seat-offline")).toBe(true);
    expect(el.classList.contains("is-dragging")).toBe(true);
    expect(el.classList.contains("is-drop-before")).toBe(true);
    cleanup();
    // Dragged down, the seat lands after the target: the marker is on its trailing edge.
    const after = card({ seatState: "free", dropSide: "after" });
    expect(after.classList.contains("is-drop-after")).toBe(true);
    expect(after.classList.contains("is-drop-before")).toBe(false);
  });
});

describe("SessionCardAction", () => {
  test("shows the short label, and is NAMED by the full one (reader, tooltip, tests)", () => {
    const onClick = vi.fn();
    render(<SessionCardAction label="+ Время" fullLabel="Добавить время" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Добавить время" });
    expect(button.textContent).toBe("+ Время");
    expect(button.getAttribute("title")).toBe("Добавить время");
    expect(button.classList.contains("session-card__btn")).toBe(true);
    expect(button.classList.contains("is-danger")).toBe(false);

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("a destructive action is red and spans the row", () => {
    render(<SessionCardAction label="Стоп" fullLabel="Стоп" danger />);
    const button = screen.getByRole("button", { name: "Стоп" });
    expect(button.classList.contains("is-danger")).toBe(true);
    expect(button.classList.contains("session-card__btn--wide")).toBe(true);
  });

  test("wide spans the row without being red", () => {
    render(<SessionCardAction label="Пересадить" fullLabel="Переместить игрока" wide />);
    const button = screen.getByRole("button", { name: "Переместить игрока" });
    expect(button.classList.contains("session-card__btn--wide")).toBe(true);
    expect(button.classList.contains("is-danger")).toBe(false);
  });

  test("disabled stays disabled", () => {
    render(<SessionCardAction label="Пауза" fullLabel="Пауза" disabled />);
    expect((screen.getByRole("button", { name: "Пауза" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

/**
 * The state is said by shape and word as well as colour (2026-10-27): every
 * card carries a stripe and a corner icon whose tone and name follow the seat.
 */
describe("the seat's state, not by colour alone", () => {
  const label = (tone: string) => `tone:${tone}`;
  test.each([
    ["playing", { session: running(30 * 60_000) }],
    ["ending", { session: running(3 * 60_000) }],
    ["critical", { session: running(30_000) }],
    ["paused", { session: running(60_000, { paused_at: new Date().toISOString() }) }],
    ["free", { seatState: "free" as const }],
    ["booked", { seatState: "reserved" as const }],
    ["offline", { seatState: "offline" as const }],
  ])("%s", (tone, props) => {
    const el = card({ stateLabel: label, ...props });
    expect(el.dataset.tone).toBe(tone);
    const icon = el.querySelector(".session-card__state")!;
    expect(icon.getAttribute("aria-label")).toBe(`tone:${tone}`);
    expect(icon.querySelector("svg")).toBeTruthy();
    expect(el.querySelector(".session-card__stripe")).toBeTruthy();
  });

  test("each tone draws its own shape", () => {
    const shapes = new Set<string>();
    for (const props of [
      { session: running(30 * 60_000) }, { session: running(3 * 60_000) }, { session: running(30_000) },
      { session: running(60_000, { paused_at: new Date().toISOString() }) },
      { seatState: "free" as const }, { seatState: "reserved" as const }, { seatState: "offline" as const },
    ]) {
      cleanup();
      shapes.add(card(props).querySelector(".session-card__state svg")!.innerHTML);
    }
    expect(shapes.size).toBe(7);
  });
});

/**
 * «Ещё» (2026-10-27): the Simple interface folds the less frequent actions;
 * every other interface renders them inline, exactly as before.
 */
describe("CardOverflow", () => {
  const actions = (onPause: () => void) => (
    <>
      <SessionCardAction label="+ Время" fullLabel="Добавить время" onClick={() => {}} />
      <SessionCardAction label="Пауза" fullLabel="Пауза" onClick={onPause} />
    </>
  );

  test("not folded: the same buttons, inline, no menu", () => {
    render(<CardOverflow collapsed={false} label="Ещё">{actions(() => {})}</CardOverflow>);
    expect(screen.getByRole("button", { name: "Пауза" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ещё" })).toBeNull();
    expect(document.querySelector(".session-card__more")).toBeNull();
  });

  test("folded: hidden until «Ещё» is pressed; the action runs its own handler and closes the menu", () => {
    const onPause = vi.fn();
    render(<CardOverflow collapsed label="Ещё">{actions(onPause)}</CardOverflow>);
    expect(screen.queryByRole("button", { name: "Пауза" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ещё" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Пауза" }));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("Escape and a click outside close it without running anything", () => {
    const onPause = vi.fn();
    render(<div><span data-testid="outside">x</span><CardOverflow collapsed label="Ещё">{actions(onPause)}</CardOverflow></div>);
    fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onPause).not.toHaveBeenCalled();
  });
});
