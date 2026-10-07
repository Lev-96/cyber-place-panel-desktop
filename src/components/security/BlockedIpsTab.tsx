import { validationMessageOf } from "@/api/security";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useKeyedBusy } from "@/hooks/useKeyedBusy";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import LoginLockoutsSection from "@/components/security/LoginLockoutsSection";
import { securityRepository } from "@/repositories/SecurityRepository";
import { FormEvent, useState } from "react";

/** Server-side limits are the real ones; these only stop a paste of a novel. */
const IP_MAX = 64;
const NOTE_MAX = 255;

/**
 * Blocked IP addresses and ranges (IPv4, IPv6, CIDR). A blocked caller gets a
 * 403 on every backend request. Whether an entry is valid — the syntax, a
 * duplicate, or a rule that would lock out the admin typing it — is the
 * server's answer (422), shown under the field in its own words; the panel
 * does not second-guess an address, it shows "your IP" so the admin can.
 * Below it, the sign-ins closed after too many wrong passwords (2026-10-07).
 */
const BlockedIpsTab = () => {
  const { t } = useLang();
  const confirm = useConfirm();
  const { begin, end, isBusy } = useKeyedBusy();
  const { data, loading, error, reload } = useAsync(() => securityRepository.blockedIps(), []);

  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // Unblocking an address the sign-in guard banned lifts its sign-in locks too.
  const [locksKey, setLocksKey] = useState(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = ip.trim();
    if (!value || saving) return;
    setSaving(true);
    setFieldError(null);
    try {
      await securityRepository.blockIp({ ip_address: value, note: note.trim() || undefined });
      setIp("");
      setNote("");
      void reload();
    } catch (err) {
      setFieldError(validationMessageOf(err, "ip_address") ?? t("toast.fail.created"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number, address: string) => {
    const ok = await confirm(fmt(t("security.ips.confirmDelete"), address), {
      confirmLabel: t("security.ips.unblock"),
      destructive: true,
    });
    if (!ok || !begin(id)) return;
    try {
      await securityRepository.unblockIp(id);
    } catch {
      // The toast said it failed; the re-read shows what is true.
    } finally {
      end(id);
    }
    void reload();
    setLocksKey((k) => k + 1);
  };

  const rows = data?.data ?? [];

  return (
    <div className="col sec-stack">
      <form className="card sec-form" onSubmit={(e) => void submit(e)} noValidate>
        <div className="sec-form__fields">
          <label className="sec-field sec-field--grow">
            <span className="label">{t("security.ips.address")}</span>
            <input
              className="input sec-num"
              value={ip}
              onChange={(e) => { setIp(e.target.value); setFieldError(null); }}
              placeholder={t("security.ips.addressHint")}
              maxLength={IP_MAX}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "sec-ip-error" : undefined}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="sec-field sec-field--grow">
            <span className="label">{t("security.note")}</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
          </label>
          <Button type="submit" className="sec-form__submit" disabled={saving || !ip.trim()}>
            {t("security.ips.block")}
          </Button>
        </div>
        {fieldError && <div id="sec-ip-error" className="error" role="alert">{fieldError}</div>}
        {data?.your_ip && (
          <div className="muted sec-hint">
            {t("security.yourIp")} <span className="sec-num">{data.your_ip}</span>
          </div>
        )}
      </form>

      <StateSwitch
        view={deriveViewState({ loading, error, data: data ? rows : null })}
        skeleton={<ListSkeleton rows={4} />}
        size="section"
        onRetry={() => void reload()}
        error={{ titleKey: "security.state.errorTitle" }}
        empty={{ titleKey: "security.ips.state.emptyTitle", descriptionKey: "security.ips.state.emptyDescription" }}
      >
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th scope="col">{t("security.ips.address")}</th>
                <th scope="col">{t("security.note")}</th>
                <th scope="col">{t("security.col.addedBy")}</th>
                <th scope="col">{t("security.col.created")}</th>
                <th scope="col"><span className="sec-sr-only">{t("security.col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label={t("security.ips.address")} className="sec-num">{r.ip_address}</td>
                  <td data-label={t("security.note")} className="sec-wrap">{r.note || "-"}</td>
                  <td data-label={t("security.col.addedBy")}>
                    {r.reason && r.reason !== "manual" ? (
                      <span className="pill blocked">{t(r.reason === "auto_login" ? "security.ips.autoLogin" : "security.ips.autoThreat")}</span>
                    ) : (r.created_by?.name ?? "-")}
                  </td>
                  <td data-label={t("security.col.created")}>{formatDateTime(r.created_at)}</td>
                  <td data-label={t("security.col.actions")}>
                    <Button
                      type="button"
                      variant="secondary"
                      className="sec-btn is-danger"
                      disabled={isBusy(r.id)}
                      onClick={() => void remove(r.id, r.ip_address)}
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

      <LoginLockoutsSection refreshKey={locksKey} />
    </div>
  );
};

export default BlockedIpsTab;
