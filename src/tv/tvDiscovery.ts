/**
 * The desktop's "find TVs on the club network" bridge (2026-11-23), the
 * renderer side of `electron/tv/discovery.ts`. Absent in the owner web and in
 * an older preload: callers check {@link tvDiscoveryAvailable} and offer the
 * code instead.
 */
export type TvEnv = "staging" | "production";

export interface FoundTv {
  address: string;
  code: string;
  env: TvEnv;
  maker: string;
  model: string;
}

interface TvBridge {
  discover: (timeoutMs?: number) => Promise<FoundTv[]>;
}

const bridge = (): TvBridge | null => {
  const b = (globalThis as { cyberplaceTV?: TvBridge }).cyberplaceTV;
  return b && typeof b.discover === "function" ? b : null;
};

export const tvDiscoveryAvailable = (): boolean => bridge() !== null;

/**
 * This build's backend: a staging panel pairs staging TVs, a production
 * panel production ones (a code exists only on the backend the TV talks to).
 * null in development and tests: every TV is offered.
 */
export const panelTvEnv = (mode: string = import.meta.env.MODE): TvEnv | null =>
  mode === "staging" ? "staging" : mode === "production" ? "production" : null;

export interface Discovery {
  /** TVs of this panel's backend, by model then address. */
  matching: FoundTv[];
  /** Found, but running the other build of the TV app. */
  otherEnv: number;
}

export const splitByEnv = (found: FoundTv[], env: TvEnv | null): Discovery => {
  const matching = found
    .filter((tv) => env === null || tv.env === env)
    .sort((a, b) => `${a.maker} ${a.model}`.localeCompare(`${b.maker} ${b.model}`) || a.address.localeCompare(b.address));
  return { matching, otherEnv: found.length - matching.length };
};

/** Never throws: a failed scan is an empty one. */
export const discoverTvs = async (env: TvEnv | null = panelTvEnv()): Promise<Discovery> => {
  const b = bridge();
  if (!b) return { matching: [], otherEnv: 0 };
  try {
    const found = await b.discover(2000);
    return splitByEnv(Array.isArray(found) ? found : [], env);
  } catch {
    return { matching: [], otherEnv: 0 };
  }
};
