import { apiMetrikaSummary, IMetrikaSummary, MetrikaPeriod } from "@/api/metrika";

/**
 * Website analytics (Yandex.Metrica).
 *
 * Behind a repository like every other domain so screens never touch `api/`
 * directly and the transport can change without touching the UI.
 */
export class MetrikaRepository {
  /**
   * Figures for one reporting window.
   *
   * Note this never rejects for an analytics outage — the backend reports that
   * through `summary.status`, so callers render a state rather than an error.
   * A rejection here means a real transport/auth failure of OUR api.
   */
  async summary(period: MetrikaPeriod, fresh = false): Promise<IMetrikaSummary> {
    const res = await apiMetrikaSummary(period, fresh);
    return res.data;
  }
}

export const metrikaRepository = new MetrikaRepository();
