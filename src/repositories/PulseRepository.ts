import { apiIssuePulseAccessLink, IPulseAccessLink } from "@/api/pulse";

/**
 * Access to the backend's Pulse monitoring dashboard.
 *
 * Kept behind a repository like every other domain so components never touch
 * `api/` directly, and so the "how do we get into Pulse" decision has exactly
 * one home if it ever changes (e.g. an embedded view instead of the browser).
 */
export class PulseRepository {
  /**
   * Ask the backend for a one-time entry link for the current admin.
   *
   * The link is deliberately NOT cached: it is single-use and expires within
   * a couple of minutes, so every "open Pulse" click must mint a fresh one.
   */
  async issueAccessLink(): Promise<IPulseAccessLink> {
    const res = await apiIssuePulseAccessLink();
    return res.data;
  }
}

export const pulseRepository = new PulseRepository();
