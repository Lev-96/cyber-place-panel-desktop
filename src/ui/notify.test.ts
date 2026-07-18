import { describe, it, expect } from "vitest";
import { notify, withToast, type ToastEvent } from "./notify";

describe("notify / withToast", () => {
  it("emits a success event and returns the value on resolve", async () => {
    const events: ToastEvent[] = [];
    const unsub = notify.subscribe((e) => events.push(e));
    const result = await withToast("place", "created", async () => 42);
    unsub();

    expect(result).toBe(42);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "success", entity: "place", action: "created" });
  });

  it("emits an error event and re-throws on reject (inline handling still works)", async () => {
    const events: ToastEvent[] = [];
    const unsub = notify.subscribe((e) => events.push(e));
    await expect(
      withToast("pc", "deleted", async () => { throw new Error("boom"); }),
    ).rejects.toThrow("boom");
    unsub();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "error", entity: "pc", action: "deleted" });
  });

  it("stops delivering after unsubscribe", () => {
    const seen: ToastEvent[] = [];
    const unsub = notify.subscribe((e) => seen.push(e));
    unsub();
    notify.success("company", "created");
    expect(seen).toHaveLength(0);
  });

  it("a throwing listener does not break the caller", () => {
    const unsub = notify.subscribe(() => { throw new Error("bad listener"); });
    expect(() => notify.success("member", "updated")).not.toThrow();
    unsub();
  });
});
