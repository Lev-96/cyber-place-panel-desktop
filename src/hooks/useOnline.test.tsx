// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useOnline } from "./useOnline";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useOnline", () => {
  test("follows navigator.onLine through the online / offline events", () => {
    const onLine = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    onLine.mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(result.current).toBe(false);

    onLine.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event("online")); });
    expect(result.current).toBe(true);
  });

  test("starts offline when the machine already is", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  test("stops listening when unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnline());
    unmount();
    expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});
