import { ITelemetrySummary, TelemetryApp } from "@/api/telemetry";
import { request } from "@/api/client";
import { MetrikaPeriod } from "@/api/metrika";

/**
 * Read side of the monitoring sections.
 *
 * Deliberately `noCache: true`: the client-side response cache exists for
 * reference data, and a monitoring screen is the one place where being shown a
 * cached answer would defeat the purpose of looking. The backend already
 * collapses the load with its own short-lived cache.
 */
class TelemetryRepository {
  summary(app: TelemetryApp, period: MetrikaPeriod): Promise<ITelemetrySummary> {
    return request<{ data: ITelemetrySummary }>("/admin/telemetry/summary", {
      params: { app, period },
      noCache: true,
    }).then((r) => r.data);
  }
}

export const telemetryRepository = new TelemetryRepository();
