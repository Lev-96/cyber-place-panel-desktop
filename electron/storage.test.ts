import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Store, type StoreIo } from "./storage";

/**
 * `cyberplace.kv.json` holds the sign-in (`cp.token`, `cp.user`), the language
 * and every per-person setting of the desktop. A desktop update must never
 * lose any of it (owner rule, 2026-11-15; a manager was signed out after an
 * update, 2026-11-20).
 */
let dir = "";
let file = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cp-kv-"));
  file = join(dir, "cyberplace.kv.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const onDisk = (): Record<string, string> => JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;

const nodeIo: StoreIo = {
  readFile: (p) => fs.readFile(p, "utf8"),
  writeFile: (p, d) => fs.writeFile(p, d, "utf8"),
  rename: (a, b) => fs.rename(a, b),
};

describe("every value set reaches the disk", () => {
  test("two keys set at once are both written (the second used to wait for a write that did not carry it)", async () => {
    const store = new Store(file);
    await store.load();
    await Promise.all([store.set("window.state", "{}"), store.set("cp.token", "\"t-1\"")]);
    expect(onDisk()).toEqual({ "window.state": "{}", "cp.token": "\"t-1\"" });
  });

  test("a value set while a write is running is written after it", async () => {
    const store = new Store(file);
    await store.load();
    const first = store.set("a", "1");
    await Promise.resolve();
    const second = store.set("b", "2");
    const third = store.set("c", "3");
    await Promise.all([first, second, third]);
    expect(onDisk()).toEqual({ a: "1", b: "2", c: "3" });
    // And a fresh start (the app after an update) reads them all back.
    const next = new Store(file);
    await next.load();
    expect(next.get("b")).toBe("2");
    expect(next.get("c")).toBe("3");
  });

  test("remove is written too", async () => {
    const store = new Store(file);
    await store.load();
    await store.set("a", "1");
    await Promise.all([store.set("b", "2"), store.remove("a")]);
    expect(onDisk()).toEqual({ b: "2" });
  });
});

describe("a write cut short never costs what was already saved", () => {
  test("the process dying mid-write (the updater closing the app) leaves the previous file whole", async () => {
    writeFileSync(file, JSON.stringify({ "cp.token": "\"saved\"", "cp.lang": "\"ru\"" }));
    // A write that gets half of its bytes out and then the process is gone.
    const dying: StoreIo = {
      ...nodeIo,
      writeFile: async (p, d) => {
        await fs.writeFile(p, d.slice(0, Math.floor(d.length / 2)), "utf8");
        throw new Error("killed");
      },
    };
    const store = new Store(file, dying);
    await store.load();
    await expect(store.set("window.state", "{\"x\":1}")).rejects.toThrow("killed");

    const next = new Store(file);
    await next.load();
    expect(next.get("cp.token")).toBe("\"saved\"");
    expect(next.get("cp.lang")).toBe("\"ru\"");
  });

  test("a file that cannot be parsed is kept aside, not overwritten", async () => {
    writeFileSync(file, "{\"cp.token\":\"sav");
    const store = new Store(file);
    await store.load();
    expect(store.get("cp.token")).toBeNull();
    await store.set("cp.lang", "\"ru\"");
    const kept = readdirSync(dir).filter((f) => f.startsWith("cyberplace.kv.json.corrupt-"));
    expect(kept).toHaveLength(1);
    expect(readFileSync(join(dir, kept[0]), "utf8")).toBe("{\"cp.token\":\"sav");
  });

  test("no file yet is an empty store (first start)", async () => {
    const store = new Store(file);
    await store.load();
    expect(store.get("cp.token")).toBeNull();
  });

  test("a read that fails for a moment is tried again before anything is assumed", async () => {
    writeFileSync(file, JSON.stringify({ "cp.token": "\"saved\"" }));
    let failures = 2;
    const busy: StoreIo = {
      ...nodeIo,
      readFile: async (p) => {
        if (failures-- > 0) throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
        return fs.readFile(p, "utf8");
      },
    };
    const store = new Store(file, busy, 0);
    await store.load();
    expect(store.get("cp.token")).toBe("\"saved\"");
  });
});
