import type { AgentUpdateStatus } from "@/api/agent-updates";
import type { AppKind, UpdateCheckEntry } from "@/api/updates";
import { playFor } from "@/sound/soundEngine";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global "new update available" toast. Sits in the top-right corner
 * regardless of which route the user is on, sounds the "system" kind of
 * notification (the soft two-note ding by default; `sound/soundEngine.ts`,
 * 2026-10-27) the first time each update is seen, and goes silent once
 * the user closes it.
 *
 * What it announces:
 *   - admin — a panel or agent release waiting to be promoted (GitHub check);
 *   - owner / manager — an approved agent version still to be applied, and
 *     WHERE: the branches the server marks pending, by address (2026-11-17).
 *
 * Closing is remembered per PERSON (`u{id}:`, the panel's per-user prefix),
 * per version and, for an owner / manager, per branch. Until 2026-11-17 it was
 * one device-wide key per version, so whoever signed in next on that computer
 * was never told. Per branch, so a branch that becomes pending later (a
 * computer added) is announced even after the others were closed.
 */

const AUTO_DISMISS_MS = 12_000;

/** Every key written since 2026-11-17. */
export const updateToastDismissKey = (userId: number, app: AppKind, version: string, branchId?: number): string =>
  `u${userId}:cp.update-toast-dismissed-${app}-${version}${branchId === undefined ? "" : `-b${branchId}`}`;

/**
 * The device-wide key of builds before 2026-11-17. Read, never written: a
 * version someone closed before the update stays closed (updates never reset
 * what a person set), and every newer version is per person.
 */
const legacyDismissKey = (app: AppKind, version: string): string =>
  `cp.update-toast-dismissed-${app}-${version}`;

const isSet = (key: string): boolean => localStorage.getItem(key) !== null;

interface ToastBranch {
  id: number;
  address: string;
}

interface ActiveToast {
  app: AppKind;
  version: string;
  /** Owner / manager: the pending branches this toast names; empty for the admin's. */
  branches: ToastBranch[];
}

/** The admin's: one per app with a release on GitHub not promoted yet (unchanged). */
const adminCandidates = (userId: number, panel: UpdateCheckEntry | null, agent: UpdateCheckEntry | null): ActiveToast[] =>
  ([["panel", panel], ["agent", agent]] as const)
    .filter(([, entry]) => entry?.has_update && entry.available?.version)
    .map(([app, entry]) => ({ app, version: entry!.available!.version, branches: [] }))
    .filter(({ app, version }) => !isSet(updateToastDismissKey(userId, app, version)) && !isSet(legacyDismissKey(app, version)));

/**
 * The owner's / manager's: the approved version and the branches the SERVER
 * marks pending that this person has not closed yet. Null when none is left.
 */
const rolloutCandidate = (userId: number, rollout: AgentUpdateStatus | null): ActiveToast | null => {
  const version = rollout?.approved?.version;
  if (!version || isSet(legacyDismissKey("agent", version))) return null;

  const branches = (rollout.branches ?? [])
    .filter((b) => b.agent?.pending === true)
    .filter((b) => !isSet(updateToastDismissKey(userId, "agent", version, b.branch_id)))
    .map((b) => ({ id: b.branch_id, address: b.address }));

  return branches.length > 0 ? { app: "agent", version, branches } : null;
};

/** What "seen in this run" is keyed by: who, which app and version, which branches. */
const seenKeyOf = (userId: number, toast: ActiveToast): string =>
  `${userId}:${toast.app}-${toast.version}${toast.branches.map((b) => `-b${b.id}`).join("")}`;

const UpdatesToast = () => {
  const { panel, agent, agentRollout } = useUpdatesNotification();
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const seenRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ActiveToast | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) return;
    // Priority order: the admin's panel release, then the agent (either the
    // admin's release or the owner's / manager's pending branches). One toast
    // at a time; anything already shown in this run waits for the next update.
    const rollout = rolloutCandidate(userId, agentRollout);
    const candidates = [...adminCandidates(userId, panel, agent), ...(rollout ? [rollout] : [])];

    for (const c of candidates) {
      const key = seenKeyOf(userId, c);
      if (seenRef.current.has(key)) continue;

      seenRef.current.add(key);
      setActive(c);
      // The update ding, as the person set it (2026-10-27).
      playFor("system", `update:${key}`);

      // Auto-hide after a few seconds (nothing is remembered: closing is a
      // person's act). The timer is scoped to THIS toast — if a newer toast
      // arrives mid-countdown, the setter compares identity and leaves it be.
      setTimeout(() => {
        setActive((curr) => (curr === c ? null : curr));
      }, AUTO_DISMISS_MS);
      break;
    }
  }, [panel, agent, agentRollout, userId]);

  if (!active || userId === null) return null;

  const dismiss = () => {
    const keys = active.branches.length > 0
      ? active.branches.map((b) => updateToastDismissKey(userId, active.app, active.version, b.id))
      : [updateToastDismissKey(userId, active.app, active.version)];
    for (const key of keys) localStorage.setItem(key, "1");
    setActive(null);
  };

  const goToSection = () => {
    dismiss();
    // Admin's unified updates screen lists both panel + agent rows;
    // owner/manager have a dedicated agent-only screen and no
    // visibility into the panel app. Routing per role prevents the
    // RoleGuard from bouncing admin away from a forbidden agent-only
    // path when they click a toast about an agent release.
    const target =
      user?.role === "admin" ? "/settings/updates" : "/settings/agent-updates";
    navigate(target);
  };

  const message = active.branches.length > 0
    ? fmt(t("updates.toastAgentBranches"), active.branches.map((b) => b.address).join(", "))
    : t(active.app === "panel" ? "updates.toastPanel" : "updates.toastAgent");

  return (
    <div
      className="cp-update-toast"
      role="status"
      aria-live="polite"
      onClick={goToSection}
    >
      <div className="cp-update-toast-emoji">🎉</div>
      <div className="cp-update-toast-body">
        <div className="cp-update-toast-title">{t("updates.toastTitle")}</div>
        <div className="cp-update-toast-message">{message}</div>
        <div className="cp-update-toast-cta">{t("updates.toastCta")}</div>
      </div>
      <button
        type="button"
        className="cp-update-toast-close"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        aria-label={t("action.close")}
      >
        ✕
      </button>
    </div>
  );
};

export default UpdatesToast;
