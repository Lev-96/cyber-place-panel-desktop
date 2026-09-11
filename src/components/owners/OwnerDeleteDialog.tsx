import { formatApiError } from "@/api/errors";
import {
  deletionBlockersOf, IOwnerApi, IOwnerDeletionPreviewApi, ITenantDeletionBlockerApi,
  TENANT_DELETION_BLOCKER, TenantDeletionBlockerCode,
} from "@/api/owners";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { ownerRepository } from "@/repositories/OwnerRepository";
import { useState } from "react";

type T = (key: string) => string;

const KNOWN_BLOCKERS: ReadonlySet<string> = new Set<TenantDeletionBlockerCode>(Object.values(TENANT_DELETION_BLOCKER));

/**
 * One blocker in the operator's language, keyed by the backend's code. A code
 * this build does not know falls back to the server's sentence — which is in
 * the language the request negotiated, so still readable.
 */
export const blockerText = (t: T, b: ITenantDeletionBlockerApi): string =>
  KNOWN_BLOCKERS.has(b.code) ? fmt(t(`owners.blocker.${b.code}`), b.count) : b.message;

interface MessageInput {
  name: string;
  preview: IOwnerDeletionPreviewApi | null;
  loading: boolean;
  loadError: string | null;
  /** Blockers to show; empty when the delete may run. */
  blockers: ITenantDeletionBlockerApi[];
  blocked: boolean;
  failure: string | null;
}

/**
 * The confirmation text: what is being deleted, what goes with it (the
 * preview's counts), and either "cannot be undone" or why it cannot run yet.
 * `ConfirmDialog` renders it `pre-line`, one fact per line.
 */
export const deletionMessage = (t: T, m: MessageInput): string => {
  const lines = [fmt(t("owners.delete.question"), m.name)];

  if (!m.preview) {
    lines.push("", m.loading ? t("owners.delete.loading") : t("owners.delete.loadFailed"));
    if (!m.loading && m.loadError) lines.push(m.loadError);
    return lines.join("\n");
  }

  const p = m.preview;
  lines.push(
    "",
    t("owners.delete.takes"),
    `• ${fmt(t("owners.delete.companies"), p.companies)}`,
    `• ${fmt(t("owners.delete.branches"), p.branches)}`,
    `• ${fmt(t("owners.delete.managers"), p.managers)}`,
    `• ${fmt(t("owners.delete.places"), p.places)}`,
    `• ${fmt(t("owners.delete.sessions"), p.sessions_total_count)}`,
    `• ${fmt(t("owners.delete.members"), p.members_with_balance)}`,
    "",
  );

  if (m.blocked) {
    lines.push(t("owners.delete.blocked"), ...m.blockers.map((b) => `• ${blockerText(t, b)}`));
  } else {
    lines.push(t("owners.delete.irreversible"));
  }

  if (m.failure) lines.push("", m.failure);
  return lines.join("\n");
};

interface Props {
  owner: IOwnerApi;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Deleting an owner removes every company they own with everything under it.
 * So the dialog asks the server FIRST (`GET /admin/owners/{id}` → `deletion`)
 * and shows the counts before anything can be confirmed; while that answer is
 * missing — loading or failed — Delete is refused.
 *
 * The server refuses the delete while live work remains (running sessions,
 * upcoming bookings). The preview says so up front (`can_delete: false`), and
 * the delete itself can still answer 409 if the world moved in between — its
 * blockers are computed under the delete's own locks, so they replace the
 * preview's and the button stays refused. Either way the admin reads what to
 * resolve, in plain language, and Cancel is the only way out.
 */
const OwnerDeleteDialog = ({ owner, onClose, onDeleted }: Props) => {
  const { t } = useLang();
  const { data, loading, error } = useAsync(() => ownerRepository.byId(owner.id), [owner.id]);
  const [refused, setRefused] = useState<ITenantDeletionBlockerApi[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = data?.deletion ?? null;
  const blocked = refused !== null || (preview !== null && !preview.can_delete);
  const blockers = refused ?? preview?.blockers ?? [];
  const canConfirm = preview !== null && !blocked && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setFailure(null);
    try {
      await ownerRepository.remove(owner.id);
      onDeleted();
    } catch (e) {
      const serverBlockers = deletionBlockersOf(e);
      if (serverBlockers) setRefused(serverBlockers);
      else setFailure(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      message={deletionMessage(t, {
        name: owner.name,
        preview,
        loading,
        loadError: error ? formatApiError(error) : null,
        blockers,
        blocked,
        failure,
      })}
      confirmLabel={busy ? "…" : t("action.delete")}
      cancelLabel={t("action.cancel")}
      destructive
      confirmDisabled={!canConfirm}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
};

export default OwnerDeleteDialog;
