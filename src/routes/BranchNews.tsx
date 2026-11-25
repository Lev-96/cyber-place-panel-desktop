import Button from "@/components/ui/Button";
import ImageUpload from "@/components/ui/ImageUpload";
import { storageUri } from "@/infrastructure/AppConfig";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

/** The server's own limits (`BranchNewsController`). */
export const NEWS_TITLE_MAX = 120;
export const NEWS_BODY_MAX = 2000;

/**
 * «Новости клуба» of one branch (2026-11-25, owner): the owner or a manager
 * writes a piece of news; every player with the branch's Club Card gets it on
 * their phone and sees it on the card. One form above, the posted news below.
 */
const BranchNews = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const ask = useConfirm();
  const list = useAsync(() => bonusRepository.news(id), [id]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // An optional picture (2026-11-25, owner); the picker is renewed after a post.
  const [image, setImage] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const ready = title.trim() !== "" && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      await bonusRepository.postNews(id, { title: title.trim(), body: body.trim() === "" ? null : body.trim(), ...(image ? { image } : {}) });
      notify.message("success", t("news.published"));
      setTitle("");
      setBody("");
      setImage(null);
      setPickerKey((k) => k + 1);
      void list.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (n: { id: number; title: string }) => {
    if (!(await ask(t("news.removeConfirm").replace("{0}", n.title), { confirmLabel: t("news.remove"), destructive: true }))) return;
    setRemoving(n.id);
    try {
      await bonusRepository.removeNews(id, n.id);
      notify.message("success", t("news.removed"));
      void list.reload();
    } catch (e2) {
      notify.message("error", e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setRemoving(null);
    }
  };

  const view = deriveViewState({ loading: list.loading, error: list.error, data: list.data, hasFilters: false });

  return (
    <div className="col" style={{ gap: 18, maxWidth: 760 }}>
      <h2 className="page-title" style={{ margin: 0 }}>{t("news.title")}</h2>
      <p className="muted" style={{ margin: 0 }}>{t("news.lead")}</p>

      <form className="card col news-form" style={{ gap: 12 }} onSubmit={submit} data-testid="news-form">
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("news.headline")}</span>
          <input className="input" value={title} maxLength={NEWS_TITLE_MAX} disabled={busy} placeholder={t("news.headlinePlaceholder")}
            onChange={(e) => setTitle(e.target.value)} data-testid="news-title" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("news.text")} <span className="muted">({t("news.optional")})</span></span>
          <textarea className="input news-form__text" value={body} maxLength={NEWS_BODY_MAX} rows={5} disabled={busy}
            onChange={(e) => setBody(e.target.value)} data-testid="news-body" />
          <span className="muted news-form__count">{body.length} / {NEWS_BODY_MAX}</span>
        </label>
        <div className="col" style={{ gap: 6 }} data-testid="news-image">
          <ImageUpload key={pickerKey} label={t("news.image")} initialUrl={null} onChange={setImage} />
          <span className="muted" style={{ fontSize: 12 }}>{t("news.imageHint")}</span>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div>
          <Button type="submit" disabled={!ready} data-testid="news-publish">{t("news.publish")}</Button>
        </div>
      </form>

      <StateSwitch
        view={view}
        skeleton={<ListSkeleton />}
        onRetry={() => void list.reload()}
        error={{ titleKey: "news.errorTitle" }}
        empty={{ titleKey: "news.emptyTitle", descriptionKey: "news.emptyDescription" }}
      >
        <div className="col" style={{ gap: 10 }} data-testid="news-list">
          {(list.data ?? []).map((n) => (
            <article key={n.id} className="card news-item" data-testid="news-item">
              <div className="row-between" style={{ alignItems: "flex-start", gap: 12 }}>
                <div className="col" style={{ gap: 4, minWidth: 0 }}>
                  {n.at && <time className="muted news-item__when" dateTime={n.at}>{formatDateTime(n.at)}</time>}
                  <strong className="news-item__title">{n.title}</strong>
                  {n.body && <p className="news-item__body">{n.body}</p>}
                  {n.image_path && <img className="news-item__img" src={storageUri(n.image_path) ?? undefined} alt="" loading="lazy" />}
                </div>
                <Button type="button" variant="secondary" disabled={removing === n.id} onClick={() => void remove(n)} data-testid={`news-remove-${n.id}`}>
                  {t("news.remove")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </StateSwitch>
    </div>
  );
};

export default BranchNews;
