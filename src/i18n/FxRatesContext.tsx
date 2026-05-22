import { Currency, DEFAULT_RATES } from "@/i18n/currency";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";

/**
 * Live FX rates with a 1-day cache. The desktop panel fetches today's
 * AMD→{USD,RUB} rates from a free public endpoint on mount, caches
 * the result in localStorage keyed by date, and mutates the shared
 * DEFAULT_RATES singleton so every consumer (PriceInput, the FX
 * suffix on HourlyRatesForm, moneyDisplay.format calls everywhere)
 * sees the same number.
 *
 * Why client-side: same desktop binary runs on staff PCs that all
 * have internet; rates change once per day so a single fetch per
 * device per day is cheap and avoids adding a backend endpoint + a
 * cache layer for what's basically a static daily snapshot.
 *
 * Resilience:
 *   - If today's cache exists in localStorage, we apply it
 *     synchronously and skip the network entirely.
 *   - If the fetch fails AND there's a stale-but-recent cache, we
 *     use it instead of the hardcoded fallback.
 *   - Final fallback is the hardcoded DEFAULT_RATES already in
 *     currency.ts — the panel keeps working offline forever, just
 *     against the last-known rates.
 *
 * Components that need to react to a rate refresh call useFxRates()
 * and read `version`; bumping the version forces a re-render so the
 * displayed values get re-derived through DEFAULT_RATES (which has
 * been mutated under them).
 */

interface FxRatesState {
  /** Bumped every time DEFAULT_RATES is mutated. Use as a re-render trigger. */
  version: number;
  /** True until the first fetch (or cache restore) settles on mount. */
  loading: boolean;
  /** Date string (YYYY-MM-DD) of the snapshot currently applied, if any. */
  appliedFor: string | null;
}

const FxRatesContext = createContext<FxRatesState>({
  version: 0,
  loading: true,
  appliedFor: null,
});

export const useFxRates = (): FxRatesState => useContext(FxRatesContext);

const CACHE_PREFIX = "fxRates:";
const FX_API_URL = "https://open.er-api.com/v6/latest/AMD";

/** YYYY-MM-DD in local TZ — stable cache key per calendar day. */
const todayKey = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** Currencies we actually use in the UI. Skipping the rest of the API
 *  payload keeps localStorage cache tiny and avoids accidental writes
 *  to currencies the rest of the app doesn't know about. */
const TRACKED: Currency[] = ["AMD", "USD", "RUB"];

interface CachedRates {
  date: string;
  rates: Record<Currency, number>;
}

const readCache = (): CachedRates | null => {
  try {
    const date = todayKey();
    const raw = localStorage.getItem(`${CACHE_PREFIX}${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (parsed?.date !== date || typeof parsed.rates !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (rates: Record<Currency, number>) => {
  try {
    const payload: CachedRates = { date: todayKey(), rates };
    localStorage.setItem(`${CACHE_PREFIX}${todayKey()}`, JSON.stringify(payload));
  } catch {
    // Quota or sandboxed storage — non-fatal, we just won't have a
    // cache next launch and will re-fetch.
  }
};

/** Walk localStorage looking for the most recent fxRates:* entry that
 *  is NOT today's. Used as the last-resort fallback when both the
 *  fresh fetch and today's cache miss — better to show yesterday's
 *  rate than the hardcoded 2026-05-23 snapshot. */
const readMostRecentStaleCache = (): CachedRates | null => {
  try {
    const today = todayKey();
    let bestDate = "";
    let best: CachedRates | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_PREFIX)) continue;
      const date = key.slice(CACHE_PREFIX.length);
      if (date === today) continue;
      if (date > bestDate) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as CachedRates;
          if (parsed?.rates) {
            best = parsed;
            bestDate = date;
          }
        } catch {
          // skip bad entry
        }
      }
    }
    return best;
  } catch {
    return null;
  }
};

const applyRates = (next: Record<Currency, number>) => {
  // Mutate DEFAULT_RATES in place so every consumer reading from it
  // (PriceInput, moneyDisplay.format, HourlyRatesForm FX suffix)
  // picks up the new numbers on the next render pass.
  for (const c of TRACKED) {
    if (typeof next[c] === "number" && next[c] > 0) {
      DEFAULT_RATES[c] = next[c];
    }
  }
};

interface ApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

const fetchToday = async (): Promise<Record<Currency, number> | null> => {
  try {
    const res = await fetch(FX_API_URL);
    if (!res.ok) return null;
    const json: ApiResponse = await res.json();
    if (json.result !== "success" || !json.rates) return null;
    // The API returns AMD→target (e.g. "RUB": 0.1944). Our
    // DEFAULT_RATES contract is identical: 1 AMD costs X target.
    const next: Record<Currency, number> = {
      AMD: 1,
      USD: typeof json.rates.USD === "number" ? json.rates.USD : DEFAULT_RATES.USD,
      RUB: typeof json.rates.RUB === "number" ? json.rates.RUB : DEFAULT_RATES.RUB,
    };
    return next;
  } catch {
    return null;
  }
};

export const FxRatesProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<FxRatesState>({
    version: 0,
    loading: true,
    appliedFor: null,
  });

  useEffect(() => {
    let cancelled = false;

    const today = todayKey();

    // Step 1: hot path — today's cache hits, no network needed.
    const cachedToday = readCache();
    if (cachedToday) {
      applyRates(cachedToday.rates);
      setState({ version: 1, loading: false, appliedFor: today });
      return;
    }

    // Step 2: seed from the most recent stale cache so the UI has
    // something defensible to render WHILE the network call resolves.
    const stale = readMostRecentStaleCache();
    if (stale) {
      applyRates(stale.rates);
      setState((prev) => ({ ...prev, version: prev.version + 1 }));
    }

    // Step 3: fetch today's rates.
    fetchToday().then((next) => {
      if (cancelled) return;
      if (next) {
        applyRates(next);
        writeCache(next);
        setState((prev) => ({
          version: prev.version + 1,
          loading: false,
          appliedFor: today,
        }));
      } else {
        // No fresh data, no fresh cache — keep whatever we seeded
        // (stale or hardcoded) and just stop the loader.
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <FxRatesContext.Provider value={state}>{children}</FxRatesContext.Provider>;
};
