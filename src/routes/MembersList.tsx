import MemberForm from "@/components/members/MemberForm";
import Button from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { memberRepository } from "@/repositories/MemberRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

const MembersList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();
  const [search, setSearch] = useState("");
  /**
   * The search the list on screen was asked for. The box is sent on Enter /
   * Search, not per keystroke, so what is typed and what was searched differ —
   * and "no hits" must be judged against the latter (no results), never read
   * as "this branch has no customers" (empty).
   */
  const [applied, setApplied] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useAsync(() => memberRepository.list(id, applied), [id, applied]);

  // The same search again is a refresh; a new one is a new request.
  const runSearch = () => { if (search === applied) void reload(); else setApplied(search); };

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const view = deriveViewState({ loading, error, data, hasFilters: applied.trim() !== "" });

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("members.title")} · №{id}</h2>
        <Button onClick={() => setCreating(true)}>{t("members.new")}</Button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input className="input" placeholder={t("members.search")} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} />
        <Button variant="secondary" onClick={runSearch}>{t("action.search")}</Button>
      </div>
      <StateSwitch
        view={view}
        skeleton={<ListSkeleton />}
        onRetry={() => void reload()}
        error={{ titleKey: "members.state.errorTitle" }}
        empty={{ titleKey: "members.state.emptyTitle", descriptionKey: "members.state.emptyDescription" }}
        noResults={{ descriptionKey: "members.state.noResultsDescription" }}
      >
        <div className="list">
          {(data ?? []).map((m) => (
            <Link key={m.id} to={`/branches/${id}/members/${m.id}`} className="list-item">
              <div>
                <div className="name">{m.name}</div>
                <div className="meta">{m.phone ?? "-"} · {m.email ?? "-"} {m.card_code && <>· {t("members.cardLabel")} {m.card_code}</>}</div>
              </div>
              <div style={{ fontWeight: 700, color: "#07ddf1" }}>{money(Number(m.balance))}</div>
            </Link>
          ))}
        </div>
      </StateSwitch>
      {creating && <MemberForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
    </div>
  );
};

export default MembersList;
