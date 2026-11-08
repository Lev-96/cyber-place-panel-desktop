// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { CardOverflow, SessionCardAction } from "./SessionCard";

/**
 * A card action's picture (2026-11-03): drawn beside the word, hidden by CSS
 * until a list row is too narrow for the words. The button's name and
 * tooltip are the full label either way, so nothing a screen reader, a hover
 * or a test finds by changes.
 */
afterEach(cleanup);

describe("SessionCardAction with a picture", () => {
  test("the word and the picture are both there; the name is the full label", () => {
    render(<SessionCardAction data-action="pause" icon="pause" label="Пауза" fullLabel="Поставить на паузу" />);
    const btn = screen.getByRole("button", { name: "Поставить на паузу" });
    expect(btn.getAttribute("title")).toBe("Поставить на паузу");
    expect(btn.querySelector(".session-card__btn-text")?.textContent).toBe("Пауза");
    const svg = btn.querySelector("svg.session-card__btn-icon");
    expect(svg?.getAttribute("data-action-icon")).toBe("pause");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  test("without a picture: exactly the word, as before", () => {
    render(<SessionCardAction data-action="x" label="Товар" fullLabel="Добавить товар" />);
    const btn = screen.getByRole("button", { name: "Добавить товар" });
    expect(btn.textContent).toBe("Товар");
    expect(btn.querySelector("svg")).toBeNull();
  });

  test("the «Ещё» menu button carries its picture too", () => {
    render(<CardOverflow collapsed label="Ещё"><span /></CardOverflow>);
    const btn = screen.getByRole("button", { name: "Ещё" });
    expect(btn.querySelector('svg[data-action-icon="more"]')).not.toBeNull();
    expect(btn.querySelector(".session-card__btn-text")?.textContent).toBe("Ещё ▾");
  });
});
