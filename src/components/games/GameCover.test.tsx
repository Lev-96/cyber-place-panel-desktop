// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import SmartImage from "@/components/ui/SmartImage";
import GameCover from "./GameCover";

/**
 * A game's cover in the panel lists: the picture, or the mobile app's
 * "no cover" art with the platform's icon — never a bare first letter.
 */
afterEach(cleanup);

const empty = () => document.querySelector(".game-cover-empty");
const iconKind = () => document.querySelector(".game-cover-empty .platform-icon")?.getAttribute("data-kind");

describe("GameCover", () => {
  test("no cover: the no-cover art with the platform's icon", () => {
    render(<GameCover path={null} platform="ps5" name="Tekken 8" />);
    expect(empty()).not.toBeNull();
    expect(iconKind()).toBe("ps");
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toBe("");
  });

  test("a venue's own platform gets its own icon", () => {
    render(<GameCover path="" platform="poker" name="Hold'em" />);
    expect(iconKind()).toBe("poker");
  });

  test("a cover shows the picture; a failed load falls back to the art", async () => {
    render(<GameCover path="images/games/covers/a.png" platform="pc" name="CS2" />);
    const img = document.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("/storage/images/games/covers/a.png");
    expect(empty()).toBeNull();

    await act(async () => { fireEvent.error(img); });
    expect(empty()).not.toBeNull();
    expect(iconKind()).toBe("pc");
  });

  test("SmartImage without a fallback still draws the first letter", () => {
    render(<SmartImage src={null} name="Branch" size={40} />);
    expect(document.body.textContent).toBe("B");
  });
});
