import {
  apiListBranchSubscribers,
  IBranchSubscriber,
} from "@/api/branchSubscribers";
import Input from "@/components/ui/Input";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

/**
 * Staff page listing every guest subscribed to this branch's
 * announcements. Search filters client-side by first / last / legacy
 * `name` so any historical row keeps showing up. Read-only — the
 * subscribe row is owned by the guest, deletes happen from the
 * mobile app or directly in the DB by an admin.
 */
const BranchSubscribersPage = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { data, loading, error } = useAsync(
    () => apiListBranchSubscribers(id),
    [id],
  );
  const [search, setSearch] = useState("");

  if (!Number.isFinite(id) || id <= 0) {
    return <div className="error">{t("hub.invalidId")}</div>;
  }

  const items = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const first = r.guest?.first_name?.toLowerCase() ?? "";
      const last = r.guest?.last_name?.toLowerCase() ?? "";
      const name = r.guest?.name?.toLowerCase() ?? "";
      return first.includes(q) || last.includes(q) || name.includes(q);
    });
  }, [items, search]);

  return (
    <ScreenWithBg
      bg="./bg/branch.jpg"
      title={t("subscribers.title") || "Subscribers"}
    >
      <Input
        placeholder={t("subscribers.searchPlaceholder") || "Filter by first or last name"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {filtered.map((r) => (
            <SubscriberRow key={r.id} sub={r} />
          ))}
          {!filtered.length && (
            <div className="muted">
              {items.length > 0
                ? t("subscribers.noMatches") || "No matches."
                : t("subscribers.empty") || "No subscribers yet."}
            </div>
          )}
        </div>
      )}
    </ScreenWithBg>
  );
};

const SubscriberRow = ({ sub }: { sub: IBranchSubscriber }) => {
  const first = sub.guest?.first_name?.trim() || null;
  const last = sub.guest?.last_name?.trim() || null;
  // Same display-priority rules as the participants list: split
  // first+last first (most informative), then legacy `name`, then
  // a guest-id placeholder so a row never reads as empty.
  const display =
    [first, last].filter(Boolean).join(" ") ||
    sub.guest?.name ||
    `Guest #${sub.guest_id}`;

  return (
    <div className="list-item">
      <div>
        <div className="name">{display}</div>
        <div className="meta">
          {sub.created_at ? formatDateTime(sub.created_at) : ""}
        </div>
      </div>
    </div>
  );
};

export default BranchSubscribersPage;
