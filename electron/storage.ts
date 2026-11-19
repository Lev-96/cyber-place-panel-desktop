import { promises as fs } from "node:fs";

/** The file operations the store needs; the default is Node's. Injected by tests only. */
export interface StoreIo {
  readFile(path: string): Promise<string>;
  /** Writes the whole file and, by default, flushes it to the disk. */
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}

const nodeIo: StoreIo = {
  readFile: (p) => fs.readFile(p, "utf8"),
  writeFile: async (p, d) => {
    const handle = await fs.open(p, "w");
    try {
      await handle.writeFile(d, "utf8");
      // On the disk before the rename makes it THE file: a power cut right
      // after must not leave an empty one in its place.
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  rename: (a, b) => fs.rename(a, b),
};

const READ_ATTEMPTS = 4;
const RENAME_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const codeOf = (e: unknown): string | undefined => {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
};

const isPlainObject = (v: unknown): v is Record<string, string> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * `userData/cyberplace.kv.json` — the desktop's sign-in (`cp.token`,
 * `cp.user`), language, window and every per-person setting. File name and
 * format are unchanged since the first release; nothing here migrates.
 *
 * Two guarantees (2026-11-20; an update must never cost a sign-in or a setting):
 *
 *  - **Every set reaches the disk, in order.** Writes run one at a time, and a
 *    value set while one is running is written by the next. Before, a set made
 *    during a write was handed THAT write's promise, whose bytes did not carry
 *    it — it reached the disk only if something else was set later, and was
 *    lost when the app closed first (an update's restart).
 *  - **The file on disk is always a whole one.** Each write goes to
 *    `cyberplace.kv.json.tmp`, is flushed, then renamed over the file. Writing
 *    in place truncated it first; the updater closing the app, a forced kill
 *    or a power cut in between left an empty or half file, which the next
 *    start read as "nothing saved": signed out, every setting gone.
 *
 * A file that cannot be parsed is kept aside as `….corrupt-<time>` rather than
 * overwritten by the next set, so what was in it can still be recovered.
 */
export class Store {
  private data: Record<string, string> = {};
  /** The last write started (or queued); the next one waits for it. */
  private writing: Promise<void> | null = null;
  /** A write queued behind `writing` that has not taken its snapshot yet: a set now is carried by it. */
  private queued: Promise<void> | null = null;

  constructor(
    private filePath: string,
    private io: StoreIo = nodeIo,
    private retryDelayMs = 100,
  ) {}

  async load(): Promise<void> {
    let raw: string | null = null;
    for (let attempt = 1; raw === null; attempt++) {
      try {
        raw = await this.io.readFile(this.filePath);
      } catch (e) {
        // No file yet: the first start.
        if (codeOf(e) === "ENOENT" || attempt >= READ_ATTEMPTS) {
          this.data = {};
          return;
        }
        // Busy for a moment (Windows: an antivirus scan, the installer still
        // closing the previous process): try again before assuming anything.
        await sleep(this.retryDelayMs);
      }
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (isPlainObject(parsed)) {
      this.data = parsed;
      return;
    }
    // Unreadable: keep it for recovery, start empty.
    await this.io.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => undefined);
    this.data = {};
  }

  get(key: string): string | null {
    return this.data[key] ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data[key] = value;
    await this.flush();
  }

  async remove(key: string): Promise<void> {
    delete this.data[key];
    await this.flush();
  }

  private flush(): Promise<void> {
    if (this.queued) return this.queued;
    const previous = this.writing;
    const next = (async () => {
      // Always yields at least once, so `queued` below is assigned first.
      await previous?.catch(() => undefined);
      this.queued = null;
      // The snapshot is taken now: every set made up to here is in it.
      await this.writeWhole(JSON.stringify(this.data));
    })();
    this.queued = next;
    this.writing = next;
    return next;
  }

  private async writeWhole(text: string): Promise<void> {
    const tmp = `${this.filePath}.tmp`;
    await this.io.writeFile(tmp, text);
    for (let attempt = 1; ; attempt++) {
      try {
        await this.io.rename(tmp, this.filePath);
        return;
      } catch (e) {
        if (codeOf(e) === "ENOENT") throw e;
        if (attempt >= RENAME_ATTEMPTS) {
          // The file stays locked (Windows): write it in place rather than
          // drop the value. Rare, and no worse than before.
          await this.io.writeFile(this.filePath, text);
          return;
        }
        await sleep(this.retryDelayMs);
      }
    }
  }
}
