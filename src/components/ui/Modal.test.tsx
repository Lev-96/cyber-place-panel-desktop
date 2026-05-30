// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Modal from "./Modal";

afterEach(() => cleanup());

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("Modal — backdrop close (mousedown→mouseup)", () => {
  test("closes when both mousedown and mouseup land on backdrop", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <div data-testid="card">card</div>
      </Modal>,
    );

    const wrapper = document.querySelector(".cp-modal-wrapper") as HTMLElement;
    fireEvent.mouseDown(wrapper, { target: wrapper });
    fireEvent.mouseUp(wrapper, { target: wrapper });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does NOT close when drag-select starts on card and ends on backdrop", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input data-testid="text" defaultValue="abc" />
      </Modal>,
    );

    const input = screen.getByTestId("text");
    const wrapper = document.querySelector(".cp-modal-wrapper") as HTMLElement;

    // Reproduces the Ctrl+V / drag-select-then-release-outside flow that
    // used to close the modal under the plain onClick implementation.
    fireEvent.mouseDown(input);
    fireEvent.mouseUp(wrapper, { target: wrapper });

    expect(onClose).not.toHaveBeenCalled();
  });

  test("does NOT close when mousedown is on backdrop but mouseup is on card", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <button data-testid="btn">btn</button>
      </Modal>,
    );

    const wrapper = document.querySelector(".cp-modal-wrapper") as HTMLElement;
    const btn = screen.getByTestId("btn");

    fireEvent.mouseDown(wrapper, { target: wrapper });
    fireEvent.mouseUp(btn);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Modal — keyboard", () => {
  test("Escape calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input />
      </Modal>,
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Tab from the LAST focusable wraps to the first (focus trap)", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <input data-testid="first" />
        <input data-testid="middle" />
        <button data-testid="last">last</button>
      </Modal>,
    );
    const first = screen.getByTestId("first");
    const last = screen.getByTestId("last");

    last.focus();
    expect(document.activeElement).toBe(last);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
      await flush();
    });

    expect(document.activeElement).toBe(first);
  });

  test("Shift+Tab from the FIRST focusable wraps to the last", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <input data-testid="first" />
        <button data-testid="last">last</button>
      </Modal>,
    );
    const first = screen.getByTestId("first");
    const last = screen.getByTestId("last");

    first.focus();
    expect(document.activeElement).toBe(first);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
      await flush();
    });

    expect(document.activeElement).toBe(last);
  });

  test("Tab inside the modal moves focus normally (does NOT trigger close)", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input data-testid="a" />
        <input data-testid="b" />
      </Modal>,
    );
    screen.getByTestId("a").focus();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
      await flush();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
