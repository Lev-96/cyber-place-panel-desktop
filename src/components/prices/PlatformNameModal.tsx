import { formatApiError } from "@/api/errors";
import MultiLangInput, { LangValues, langValuesFrom } from "@/components/ui/MultiLangInput";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceRepository } from "@/repositories/PlatformPriceRepository";
import { notify } from "@/ui/notify";
import { IBranchPlatformPrice } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  price: IBranchPlatformPrice;
  onClose: () => void;
  onSaved: () => void;
}

// The platform's slug (identity) is fixed — only the display наименование per
// locale is editable here. Rates are edited inline in the table, never here.
const LANGS: ReadonlyArray<{ key: "en" | "ru" | "am"; label: string }> = [
  { key: "en", label: "English" },
  { key: "ru", label: "Русский" },
  { key: "am", label: "Հայերեն" },
];

/**
 * Rename a custom platform (наименование in 3 languages). Opened by clicking a
 * platform name in the prices table. Editing a name never touches the slug or
 * any rate, so no billing path is affected. Blank ru/am fall back to English.
 *
 * The interface language leads and auto-translates into the other two; each can
 * then be corrected by hand. English stays mandatory because the platform slug
 * — its identity across the branch — is derived from it.
 */
const PlatformNameModal = ({ price, onClose, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [names, setNames] = useState<LangValues>(() =>
    langValuesFrom({ en: price.name_en, ru: price.name_ru, am: price.name_am }),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!names.en.trim()) return setErr(t("place.errors.nameRequired"));
    setBusy(true);
    setErr(null);
    try {
      const en = names.en.trim();
      await platformPriceRepository.update(price.id, {
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
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{t("platformPrice.renameTitle")}</h2>
        <MultiLangInput
          label={t("place.priceName")}
          values={names}
          onChange={setNames}
          fieldClass="platform_name"
          maxChars={60}
          required
          autoFocus
          disabled={busy}
        />
        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default PlatformNameModal;
