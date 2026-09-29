import type { IStaffAccessApi, IStaffSessionApi } from "@/api/security";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Modal from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useKeyedBusy } from "@/hooks/useKeyedBusy";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { securityRepository } from "@/repositories/SecurityRepository";
import { useState } from "react";
import { CLIENT_LABEL_KEY } from "./securityLabels";

interface Props {
  user: Pick<IStaffAccessApi, "id" | "name">;
  onClose: () => void;
  /** A session ended: the access list's session count is stale. */
  onChanged: () => void;
}

/**
 * Every live session (token) of one owner or manager: which client, which
 * device, from where, and when. One can be ended, or all of them — and "all"
 * includes the desktop panel, which the confirmation says in so many words,
 * because it signs the person out of the machine they may be working at.
 */
const StaffSessionsModal = ({ user, onClose, onChanged }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const { begin, end, isBusy } = useKeyedBusy();
  const [revokingAll, setRevokingAll] = useState(false);
  const { data, loading, error, reload } = useAsync(() => securityRepository.sessions(user.id), [user.id]);
  const sessions = data ?? [];

  const revokeOne = async (s: IStaffSessionApi) => {
    const ok = await confirm(fmt(t("security.sessions.confirmRevoke"), t(CLIENT_LABEL_KEY[s.client]), user.name), {
      confirmLabel: t("security.sessions.revoke"),
      destructive: true,
    });
    if (!ok || !begin(s.id)) return;
    try {
      await securityRepository.revokeSession(user.id, s.id);
      onChanged();
    } catch {
      // The toast said it failed; the re-read below shows what is true.
    } finally {
      end(s.id);
    }
    void reload();
  };

  const revokeAll = async () => {
    const ok = await confirm(fmt(t("security.sessions.confirmRevokeAll"), user.name), {
      confirmLabel: t("security.sessions.revokeAll"),
      destructive: true,
    });
    if (!ok || revokingAll) return;
    setRevokingAll(true);
    try {
      await securityRepository.revokeAllSessions(user.id);
      onChanged();
    } catch {
      // As above.
    } finally {
      setRevokingAll(false);
    }
    void reload();
  };

  return (
    <Modal open onClose={onClose}>
      <div className="card sec-modal">
        <div className="sec-modal__head">
          <h3 className="sec-modal__title">{fmt(t("security.sessions.title"), user.name)}</h3>
          <Button
            type="button"
            variant="secondary"
            className="sec-btn is-danger"
            onClick={() => void revokeAll()}
            disabled={revokingAll || sessions.length === 0}
          >
            {t("security.sessions.revokeAll")}
          </Button>
        </div>

        {error && <div className="error">{error.message}</div>}
        {loading && !data ? (
          <ListSkeleton rows={3} />
        ) : !error && sessions.length === 0 ? (
          <div className="muted">{t("security.sessions.empty")}</div>
        ) : !error ? (
          <div className="sec-table-wrap">
            <table className="sec-table">
              <thead>
                <tr>
                  <th scope="col">{t("security.col.client")}</th>
                  <th scope="col">{t("security.col.device")}</th>
                  <th scope="col">{t("security.col.ip")}</th>
                  <th scope="col">{t("security.col.created")}</th>
                  <th scope="col">{t("security.col.lastUsed")}</th>
                  <th scope="col">{t("security.col.expires")}</th>
                  <th scope="col"><span className="sec-sr-only">{t("security.col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td data-label={t("security.col.client")}>{t(CLIENT_LABEL_KEY[s.client])}</td>
                    <td data-label={t("security.col.device")}>
                      <div className="sec-user">
                        <span>{s.name}</span>
                        {s.user_agent && <span className="meta sec-wrap">{s.user_agent}</span>}
                      </div>
                    </td>
                    <td data-label={t("security.col.ip")} className="sec-num">{s.last_ip ?? "-"}</td>
                    <td data-label={t("security.col.created")}>{formatDateTime(s.created_at)}</td>
                    <td data-label={t("security.col.lastUsed")}>{formatDateTime(s.last_used_at)}</td>
                    <td data-label={t("security.col.expires")}>
                      {s.expires_at ? formatDateTime(s.expires_at) : t("security.sessions.noExpiry")}
                    </td>
                    <td data-label={t("security.col.actions")}>
                      <Button
                        type="button"
                        variant="secondary"
                        className="sec-btn is-danger"
                        disabled={isBusy(s.id) || revokingAll}
                        onClick={() => void revokeOne(s)}
                      >
                        {t("security.sessions.revoke")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="sec-modal__foot">
          <Button type="button" variant="secondary" onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default StaffSessionsModal;
