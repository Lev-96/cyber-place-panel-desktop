import { promises as fs } from "node:fs";

export class Store {
  private data: Record<string, string> = {};
  private flushing: Promise<void> | null = null;

  constructor(private filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw) as Record<string, string>;
    } catch {
      this.data = {};
    }
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

  private async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = fs
      .writeFile(this.filePath, JSON.stringify(this.data), "utf8")
      .finally(() => { this.flushing = null; });
    return this.flushing;
  }
}
