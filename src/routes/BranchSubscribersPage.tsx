import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  apiListBranchSubscribers,
  IBranchSubscriber,
} from "@/api/branchSubscribers";
import Input from "@/components/ui/Input";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
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
  const { data, loading, error, reload } = useAsync(
    () => apiListBranchSubscribers(id),
    [id],
  );
  const [search, setSearch] = useState("");

  const items = useMemo(() => data?.data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const first = r.guest?.first_name?.toLowerCase() ?? "";
      const last = r.guest?.last_name?.toLowerCase() ?? "";
      return first.includes(q) || last.includes(q);
    });
  }, [items, search]);

  // After every hook (the memo above used to sit below this return).
  if (!Number.isFinite(id) || id <= 0) {
    return <div className="error">{t("hub.invalidId")}</div>;
  }

  // Format a "12 subscribers" / "5 of 12" counter once and reuse it
  // in the header. When the filter is active we surface BOTH the
  // visible and the total counts so the staff sees how much is
  // hidden by the search.
  const totalLabel = t("subscribers.total") || "Subscribers";
  const isFiltering = search.trim().length > 0 && filtered.length !== items.length;
  const countText = isFiltering
    ? `${filtered.length} / ${items.length}`
    : `${items.length}`;

  return (
    <ScreenWithBg
      bg="./bg/branch.jpg"
      title={t("subscribers.title") || "Subscribers"}
    >
      {data && (
        <div className="muted" style={{ fontSize: 13 }}>
          {totalLabel}: <strong style={{ color: "#fff" }}>{countText}</strong>
        </div>
      )}
      <Input
        placeholder={t("subscribers.searchPlaceholder") || "Filter by first or last name"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <StateSwitch
        view={deriveViewState({ loading, error, data: data ? filtered : null, hasFilters: search.trim() !== "" })}
        skeleton={<ListSkeleton rows={6} />}
        onRetry={() => void reload()}
        error={{ titleKey: "subscribers.state.errorTitle" }}
        empty={{ titleKey: "subscribers.state.emptyTitle", descriptionKey: "subscribers.state.emptyDescription" }}
        noResults={{ descriptionKey: "subscribers.state.noResultsDescription" }}
      >
        <div className="list">
          {filtered.map((r) => (
            <SubscriberRow key={r.id} sub={r} />
          ))}
        </div>
      </StateSwitch>
    </ScreenWithBg>
  );
};

const SubscriberRow = ({ sub }: { sub: IBranchSubscriber }) => {
  const first = sub.guest?.first_name?.trim() || null;
  const last = sub.guest?.last_name?.trim() || null;
  // Display = first + last; fall back to a Guest-id placeholder
  // so a row with neither field still reads as something.
  const display =
    [first, last].filter(Boolean).join(" ") || `Guest №${sub.guest_id}`;

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
