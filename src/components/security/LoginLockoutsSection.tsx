import { isMissingEndpoint } from "@/api/fallback";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useKeyedBusy } from "@/hooks/useKeyedBusy";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { securityRepository } from "@/repositories/SecurityRepository";

interface Props {
  /** Bumped by the Blocked IPs list after an unblock: lifting a banned address lifts its sign-in locks too. */
  refreshKey: number;
}

/** The desktop's and the owner web's own names for where a password was typed. */
const CLIENT_LABEL_KEY: Record<string, string> = {
  desktop: "ipActivity.source.desktop",
  owner_web: "ipActivity.source.owner_web",
};

/**
 * Sign-ins closed after too many wrong passwords (2026-10-07), on the desktop
 * or the owner web, under Blocked IPs: who, from where, until when, and
 * Unlock to open one before its time runs out. A backend that has no such
 * list yet hides the section rather than showing an error.
 */
const LoginLockoutsSection = ({ refreshKey }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const { begin, end, isBusy } = useKeyedBusy();
  const { data, loading, error, reload } = useAsync(() => securityRepository.loginLockouts(), [refreshKey]);

  if (error && isMissingEndpoint(error)) return null;

  const unlock = async (id: number, email: string) => {
    const ok = await confirm(fmt(t("security.locks.confirmUnlock"), email), {
      confirmLabel: t("security.ips.unblock"),
      destructive: true,
    });
    if (!ok || !begin(id)) return;
    try {
      await securityRepository.unlockLogin(id);
    } catch {
      // The toast said it failed; the re-read shows what is true.
    } finally {
      end(id);
    }
    void reload();
  };

  const rows = data?.data ?? [];

  return (
    <section className="col sec-stack" aria-labelledby="sec-locks-title">
      <div>
        <h3 id="sec-locks-title" className="sec-section-title">{t("security.locks.title")}</h3>
        <div className="muted sec-hint">{t("security.locks.hint")}</div>
      </div>

      <StateSwitch
        view={deriveViewState({ loading, error, data: data ? rows : null })}
        skeleton={<ListSkeleton rows={2} />}
        size="compact"
        onRetry={() => void reload()}
        error={{ titleKey: "security.state.errorTitle" }}
        empty={{ titleKey: "security.locks.empty", descriptionKey: null }}
      >
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th scope="col">{t("security.locks.account")}</th>
                <th scope="col">{t("security.ips.address")}</th>
                <th scope="col">{t("security.locks.client")}</th>
                <th scope="col">{t("security.locks.attempts")}</th>
                <th scope="col">{t("security.locks.until")}</th>
                <th scope="col"><span className="sec-sr-only">{t("security.col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label={t("security.locks.account")} className="sec-wrap">
                    <div>{r.email}</div>
                    <div className="muted">
                      {r.user
                        ? `${r.user.name} · ${t(`role.${r.user.role}`) || r.user.role}`
                        : t("security.locks.unknownAccount")}
                    </div>
                  </td>
                  <td data-label={t("security.ips.address")} className="sec-num">
                    <div>{r.ip_address}</div>
                    {r.ip_banned && <span className="pill blocked">{t("security.locks.alsoIp")}</span>}
                  </td>
                  <td data-label={t("security.locks.client")}>
                    {CLIENT_LABEL_KEY[r.client] ? t(CLIENT_LABEL_KEY[r.client]) : r.client}
                  </td>
                  <td data-label={t("security.locks.attempts")} className="sec-num">{r.attempts}</td>
                  <td data-label={t("security.locks.until")}>{formatDateTime(r.locked_until)}</td>
                  <td data-label={t("security.col.actions")}>
                    <Button
                      type="button"
                      variant="secondary"
                      className="sec-btn is-danger"
                      disabled={isBusy(r.id)}
                      onClick={() => void unlock(r.id, r.email)}
                    >
                      {t("security.ips.unblock")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateSwitch>
    </section>
  );
};

export default LoginLockoutsSection;
