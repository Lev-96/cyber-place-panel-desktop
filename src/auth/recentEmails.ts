import { AppConfig } from "@/infrastructure/AppConfig";
import { IKeyValueStore, keyValueStore } from "@/infrastructure/KeyValueStore";

/** How many addresses we keep — enough for a shared venue machine, short
 *  enough that the suggestion list never becomes a wall of text. */
export const RECENT_EMAILS_LIMIT = 8;

const normalize = (email: string): string => email.trim().toLowerCase();

/**
 * The addresses that have successfully signed in on this machine, most
 * recent first — the source for the login screen's suggestions.
 *
 * Device-scoped on purpose: it is a typing aid for whoever sits at this
 * desktop, so it must survive sign-out (that is the whole point). It stores
 * ONLY addresses — never a password, never a token — and any entry can be
 * dropped again via `forget()`.
 *
 * Injectable store so tests (and any future per-profile variant) can swap
 * the persistence without touching callers.
 */
export class RecentEmailsStore {
  constructor(private readonly store: IKeyValueStore = keyValueStore) {}

  async list(): Promise<string[]> {
    const raw = await this.store.get<unknown>(AppConfig.storageKeys.recentEmails);
    if (!Array.isArray(raw)) return [];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of raw) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim();
      const key = normalize(trimmed);
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }

    return out.slice(0, RECENT_EMAILS_LIMIT);
  }

  /** Move `email` to the front of the list (case-insensitive de-dupe). */
  async remember(email: string): Promise<void> {
    const trimmed = email.trim();
    if (!trimmed) return;

    const key = normalize(trimmed);
    const next = [trimmed, ...(await this.list()).filter((e) => normalize(e) !== key)]
      .slice(0, RECENT_EMAILS_LIMIT);
    await this.store.set(AppConfig.storageKeys.recentEmails, next);
  }

  async forget(email: string): Promise<void> {
    const key = normalize(email);
    const next = (await this.list()).filter((e) => normalize(e) !== key);
    await this.store.set(AppConfig.storageKeys.recentEmails, next);
  }
}

export const recentEmails = new RecentEmailsStore();
