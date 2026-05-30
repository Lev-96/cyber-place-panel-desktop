import { request } from "./client";

/** One per-country TIN rule as served by the backend (`GET /tin-rules`). */
export interface TinRuleDto {
  country_code: string;
  pattern: string;
  flags: string;
  example: string | null;
}

/**
 * Fetch the per-country TIN validation rules. These are the single source of
 * truth (DB table `tin_rules`); the panel uses them to validate client-side
 * with the exact same patterns the backend enforces. Callers should fall back
 * to the bundled static rules (src/data/tin.ts) if this fails.
 */
export const apiGetTinRules = () =>
  request<{ tin_rules: TinRuleDto[] }>("/tin-rules");
