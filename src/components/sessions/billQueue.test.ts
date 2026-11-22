import { describe, expect, test } from "vitest";
import type { ISessionApi } from "@/types/sessions";
import { closeBill, enqueueBill, markBillEnded, openBillNow } from "./billQueue";

/** The board's bills in turn (2026-11-22, owner): none dropped, Stop first. */
const s = (id: number, status: ISessionApi["status"] = "expired") => ({ id, pc_id: id, status } as ISessionApi);
const ids = (list: { session: ISessionApi }[]) => list.map((b) => b.session.id);

describe("billQueue", () => {
  test("ended seats queue in order; the same seat twice is one bill", () => {
    let q = enqueueBill([], s(1));
    q = enqueueBill(q, s(2));
    q = enqueueBill(q, s(1));
    q = enqueueBill(q, s(3));
    expect(ids(q)).toEqual([1, 2, 3]);
  });

  test("closing the open bill opens the next; closing a waiting one keeps the open one", () => {
    const q = [s(1), s(2), s(3)].reduce((acc, x) => enqueueBill(acc, x), [] as ReturnType<typeof enqueueBill>);
    expect(ids(closeBill(q, 1))).toEqual([2, 3]);
    expect(ids(closeBill(q, 2))).toEqual([1, 3]);
    expect(ids(closeBill(q, 9))).toEqual([1, 2, 3]);
  });

  test("a Stop goes first with its press instant, and drops its own waiting copy", () => {
    const q = enqueueBill(enqueueBill([], s(2)), s(5, "active"));
    const next = openBillNow(q, s(5, "active"), 1234);
    expect(ids(next)).toEqual([5, 2]);
    expect(next[0].frozenAt).toBe(1234);
    expect(next[1].frozenAt).toBeUndefined();
  });

  test("a seat ended elsewhere becomes its final bill where it stands; an ended one is left alone", () => {
    const q = openBillNow(enqueueBill([], s(2)), s(5, "active"), 1);
    const next = markBillEnded(q, 5, "stopped");
    expect(next.map((b) => b.session.status)).toEqual(["stopped", "expired"]);
    expect(markBillEnded(next, 2, "stopped")[1].session.status).toBe("expired");
  });
});
