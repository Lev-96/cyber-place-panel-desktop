import { BlockableKind, IBlockState } from "@/api/blocking";
import { useAuth } from "@/auth/AuthContext";
import { can, Permission } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { blockingRepository } from "@/repositories/BlockingRepository";
import { useState } from "react";

interface Props {
  kind: BlockableKind;
  id: number;
  /** Shown inside the confirmation question, so the admin sees what they are about to close. */
  name: string;
  /**
   * The entity's OWN block — what this button toggles. A branch that is closed
   * only because its company is blocked has this null, and blocking it here is
   * still a meaningful thing to do: it keeps the branch closed after the
   * company reopens.
   */
  blockedAt?: string | null;
  /** Whether it is closed at all, inherited blocks included. Drives the note below the button. */
  isBlocked?: boolean;
  /** Called with the new state so the screen can refresh what it shows. */
  onChanged?: (state: IBlockState) => void;
}

const PERMISSION: Record<BlockableKind, Permission> = {
  company: "company.block",
  branch: "branch.block",
};

/**
 * The block / unblock control — one component for companies and branches.
 *
 * Everything that differs between the two scopes is a lookup on `kind`: the
 * permission, the wording, the endpoint (inside the repository). That is what
 * keeps the two identical for the person using them, and what makes a third
 * scope a matter of adding a row rather than copying a screen.
 *
 * Three rules it enforces on the way:
 *
 *  1. **Ask first, with the name in the question.** Blocking a company signs
 *     out its owner and every manager under it; that is not something to
 *     discover after a mis-click. The confirmation goes through the in-app
 *     dialog, never `window.confirm` — the native one poisons keyboard focus in
 *     Electron.
 *  2. **Say when the button cannot help.** A branch closed by its company's
 *     block says so, instead of offering an "unblock" that would leave it shut.
 *  3. **Admin only.** Renders nothing for anyone else, mirroring the backend,
 *     which refuses the call outright — the block exists to be used against a
 *     company, so its owner must not be able to lift it.
 */
const BlockToggle = ({ kind, id, name, blockedAt, isBlocked, onChanged }: Props) => {
  const { user } = useAuth();
  const { t } = useLang();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  if (!can(user?.role, PERMISSION[kind])) return null;

  const blockedItself = !!blockedAt;
  // Closed, but not by its own flag — i.e. its company is blocked.
  const closedByParent = !!isBlocked && !blockedItself;

  const onClick = async () => {
    const question = blockedItself
      ? fmt(t(`blocking.confirm.unblock.${kind}`), name)
      : fmt(t(`blocking.confirm.block.${kind}`), name);

    if (!(await confirm(question, { destructive: !blockedItself }))) return;

    setBusy(true);
    try {
      const state = blockedItself
        ? await blockingRepository.unblock(kind, id)
        : await blockingRepository.block(kind, id);
      onChanged?.(state);
    } catch {
      // The repository already raised the error toast; swallowing here keeps a
      // failed call from taking the screen down with it.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => void onClick()} disabled={busy}>
        {blockedItself ? t(`blocking.action.unblock.${kind}`) : t(`blocking.action.block.${kind}`)}
      </Button>
      {closedByParent && (
        <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
          {t("blocking.closedByCompany")}
        </span>
      )}
    </>
  );
};

export default BlockToggle;
