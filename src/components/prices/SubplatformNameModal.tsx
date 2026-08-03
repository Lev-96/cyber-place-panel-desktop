import { formatApiError } from "@/api/errors";
import MultiLangInput, { LangValues, langValuesFrom } from "@/components/ui/MultiLangInput";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
import { notify } from "@/ui/notify";
import { IBranchSubplatform } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  subplatform: IBranchSubplatform;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Rename a subplatform in all three languages. Opened by clicking its name in
 * the prices table — the same gesture, the same modal shape and the same rules
 * as {@link PlatformNameModal}, because to an operator these are the same kind
 * of thing and should not behave differently.
 *
 * The interface language leads and auto-translates into the other two; each can
 * then be corrected by hand. English stays mandatory: it is what the slug was
 * derived from, and the slug is how every place stays attached. Renaming never
 * touches the slug or any rate, so no billing path moves.
 */
const SubplatformNameModal = ({ subplatform, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [names, setNames] = useState<LangValues>(() =>
    langValuesFrom({ en: subplatform.name_en, ru: subplatform.name_ru, am: subplatform.name_am }),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!names.en.trim()) return setErr(t("subplatform.errors.nameRequired"));
    setBusy(true);
    setErr(null);
    try {
      const en = names.en.trim();
      await subplatformRepository.update(subplatform.id, {
        name_en: en,
        name_ru: names.ru.trim() || en,
        name_am: names.am.trim() || en,
      });
      notify.success("prices", "saved");
      onSaved();
    } catch (e2) {
      setErr(formatApiError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <form
        className="card"
        style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }}
        onSubmit={submit}
      >
        <h2 style={{ margin: 0 }}>{t("subplatform.renameTitle")}</h2>
        <MultiLangInput
          label={t("subplatform.name")}
          values={names}
          onChange={setNames}
          fieldClass="subplatform_name"
          maxChars={60}
          required
          autoFocus
          disabled={busy}
        />
        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t("action.cancel")}
          </Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default SubplatformNameModal;
