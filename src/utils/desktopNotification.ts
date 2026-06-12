/**
 * Thin wrapper over the HTML5 Notification API for OS-level desktop
 * pushes from the renderer. Electron exposes the standard `Notification`
 * constructor, so a push surfaces even when the panel is unfocused or
 * hidden behind another window — the "real push" the floor needs.
 *
 * Permission is requested lazily on first use and the answer cached:
 * re-asking is pointless once the user has decided. Every call is
 * failure-tolerant — some sandboxed Linux WMs (no notification daemon)
 * throw on construction even after "granted", so the OS push is always
 * best-effort sugar on top of an in-app surface, never the only signal.
 */

let permissionRequested = false;

export const ensureNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (permissionRequested) return Notification.permission;
  permissionRequested = true;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
};

/**
 * Fire an OS notification once permission allows. `onClick` runs on tap
 * (e.g. focus the window / route somewhere). Silently no-ops when
 * permission is denied or the platform can't construct one.
 */
export const showDesktopNotification = (
  title: string,
  options?: NotificationOptions,
  onClick?: () => void,
): void => {
  void ensureNotificationPermission().then((perm) => {
    if (perm !== "granted") return;
    try {
      const n = new Notification(title, options);
      if (onClick) n.onclick = onClick;
    } catch {
      /* WM without a notification daemon — swallow, in-app surface stands */
    }
  });
};
