import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";

type Map = Record<string, number>;

export class CommissionStore {
  private cache: Map | null = null;

  async getPercent(companyId: number): Promise<number> {
    const map = await this.load();
    return map[String(companyId)] ?? AppConfig.defaultCommissionPercent;
  }

  async setPercent(companyId: number, percent: number): Promise<void> {
    const safe = clamp(percent, 0, 100);
    const map = await this.load();
    map[String(companyId)] = safe;
    this.cache = map;
    await keyValueStore.set(AppConfig.storageKeys.commissionByCompany, map);
  }

  private async load(): Promise<Map> {
    if (this.cache) return this.cache;
    this.cache = (await keyValueStore.get<Map>(AppConfig.storageKeys.commissionByCompany)) ?? {};
    return this.cache;
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

export const commissionStore = new CommissionStore();
