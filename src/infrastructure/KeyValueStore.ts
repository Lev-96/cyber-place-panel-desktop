export interface IKeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

declare global {
  interface Window {
    desktopAPI?: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string): Promise<void>;
      remove(key: string): Promise<void>;
    };
  }
}

class ElectronStore implements IKeyValueStore {
  constructor(private bridge: NonNullable<Window["desktopAPI"]>) {}
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.bridge.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await this.bridge.set(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    await this.bridge.remove(key);
  }
}

class WebStore implements IKeyValueStore {
  async get<T>(key: string): Promise<T | null> {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
}

const pick = (): IKeyValueStore => {
  if (typeof window !== "undefined" && window.desktopAPI) return new ElectronStore(window.desktopAPI);
  return new WebStore();
};

export const keyValueStore: IKeyValueStore = pick();
