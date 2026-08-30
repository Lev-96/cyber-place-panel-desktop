import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { storageUri } from "@/infrastructure/AppConfig";
import type { IBranchApi } from "@/types/api";
import { useMemo, useState } from "react";

interface Props {
  branches: IBranchApi[];
  /** The branch whose thread is on screen, if any. */
  selectedId: number | null;
  onPick: (branchId: number) => void;
  busy?: boolean;
}

/**
 * Which venue is this about.
 *
 * A support request is kept per branch, so this question has to be answered
 * before there is a thread to write in — but it is asked as a list of places
 * the operator recognises, not as a dropdown of ids. Each card carries the
 * company, the branch, its address and its logo, which together are how
 * somebody who runs three venues tells them apart.
 *
 * ## Every string here can be long
 * Company names, branch names and addresses are typed by operators and some of
 * them are very long. Each line is clipped to one with an ellipsis and carries
 * its full text in `title`, and the logo never shrinks — so a card is the same
 * size whatever is in it and a grid of them stays a grid.
 *
 * ## Search appears when it helps
 * Under about half a dozen branches a search box is one more thing to look
 * past. Above that it is the fastest way in, matching on company, branch and
 * address at once because an operator remembers whichever of the three they
 * remember.
 */
const SEARCH_FROM = 6;

const BranchPicker = ({ branches, selectedId, onPick, busy }: Props) => {
  const { t } = useLang();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return branches;
    return branches.filter((b) =>
      [b.company?.name, b.address, b.city, b.country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [branches, query]);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700 }}>{t("support.chooseBranch")}</div>
        <div className="muted" style={{ fontSize: 12 }}>{t("support.chooseBranchHint")}</div>
      </div>

      {branches.length >= SEARCH_FROM && (
        <Input
          placeholder={t("support.searchBranch")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {filtered.length === 0 ? (
        <div className="support-branch-empty">
          <div style={{ fontSize: 22 }}>🔍</div>
          <div className="muted" style={{ fontSize: 13 }}>{t("support.noBranchMatches")}</div>
        </div>
      ) : (
        <div className="support-branch-grid">
          {filtered.map((branch) => {
            // Only the branch's own logo: the branch list does not carry the
            // company's, and fetching every company to decorate a picker would
            // be a lot of traffic for a fallback the placeholder covers.
            const logo = storageUri(branch.branch_logo_path);
            const company = branch.company?.name ?? "";
            const place = [branch.city, branch.country].filter(Boolean).join(", ");
            const selected = branch.id === selectedId;

            return (
              <button
                key={branch.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(branch.id)}
                className={`support-branch-card${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
              >
                <span className="support-branch-card__logo" aria-hidden>
                  {logo ? <img src={logo} alt="" /> : <span>🏢</span>}
                </span>

                <span className="support-branch-card__body">
                  {company && (
                    <span className="support-branch-card__company" title={company}>{company}</span>
                  )}
                  <span className="support-branch-card__name" title={branch.address ?? undefined}>
                    {branch.address}
                  </span>
                  {place && (
                    <span className="support-branch-card__address" title={place}>📍 {place}</span>
                  )}
                </span>

                {/* The tick is the state, not the border alone: a border
                    difference is easy to miss on a dark card, and this has to
                    be obvious at a glance. */}
                <span className="support-branch-card__check" aria-hidden>{selected ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BranchPicker;
