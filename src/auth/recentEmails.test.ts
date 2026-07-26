import { IKeyValueStore } from "@/infrastructure/KeyValueStore";
import { beforeEach, describe, expect, test } from "vitest";
import { RECENT_EMAILS_LIMIT, RecentEmailsStore } from "./recentEmails";

class MemoryStore implements IKeyValueStore {
  private data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> { return (this.data.get(key) as T) ?? null; }
  async set<T>(key: string, value: T): Promise<void> { this.data.set(key, value); }
  async remove(key: string): Promise<void> { this.data.delete(key); }
  /** Write a raw (possibly malformed) payload the way a older build might have. */
  seed(key: string, value: unknown) { this.data.set(key, value); }
}

let store: MemoryStore;
let emails: RecentEmailsStore;

beforeEach(() => {
  store = new MemoryStore();
  emails = new RecentEmailsStore(store);
});

describe("RecentEmailsStore", () => {
  test("starts empty and keeps the most recent sign-in first", async () => {
    expect(await emails.list()).toEqual([]);

    await emails.remember("levon@example.com");
    await emails.remember("manager@example.com");

    expect(await emails.list()).toEqual(["manager@example.com", "levon@example.com"]);
  });

  test("re-using an address moves it to the front instead of duplicating it", async () => {
    await emails.remember("a@example.com");
    await emails.remember("b@example.com");
    await emails.remember("A@Example.com  ");

    expect(await emails.list()).toEqual(["A@Example.com", "b@example.com"]);
  });

  test("ignores a blank address", async () => {
    await emails.remember("   ");
    expect(await emails.list()).toEqual([]);
  });

  test("forget drops the address case-insensitively", async () => {
    await emails.remember("a@example.com");
    await emails.remember("b@example.com");

    await emails.forget("A@EXAMPLE.COM");

    expect(await emails.list()).toEqual(["b@example.com"]);
  });

  test("keeps at most the configured number of addresses", async () => {
    for (let i = 0; i < RECENT_EMAILS_LIMIT + 4; i++) await emails.remember(`u${i}@example.com`);

    const list = await emails.list();
    expect(list).toHaveLength(RECENT_EMAILS_LIMIT);
    expect(list[0]).toBe(`u${RECENT_EMAILS_LIMIT + 3}@example.com`);
    expect(list).not.toContain("u0@example.com");
  });

  test("survives a corrupted payload instead of throwing", async () => {
    store.seed("cp.recentEmails", { not: "an array" });
    expect(await emails.list()).toEqual([]);

    store.seed("cp.recentEmails", ["ok@example.com", 42, null, "  ", "ok@example.com"]);
    expect(await emails.list()).toEqual(["ok@example.com"]);
  });
});
