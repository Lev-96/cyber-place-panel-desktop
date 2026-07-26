/**
 * Page navigation for the paginated lists (branches, bookings, tournaments).
 * Renders ‹ prev, a windowed set of page numbers with ellipses, and next ›.
 * Hidden entirely when there is only one page, so it never adds noise to a
 * short list.
 */

interface Props {
  page: number;
  lastPage: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Build a compact page window: always the first and last page, plus a run
 * around the current page, with "…" gaps. e.g. current=6/20 →
 * [1, "…", 5, 6, 7, "…", 20].
 */
const buildWindow = (page: number, lastPage: number): (number | "…")[] => {
  const out: (number | "…")[] = [];
  const push = (p: number) => { if (!out.includes(p)) out.push(p); };

  const around = [page - 1, page, page + 1].filter((p) => p >= 1 && p <= lastPage);
  const wanted = [1, ...around, lastPage].filter((p) => p >= 1 && p <= lastPage);
  const uniqueSorted = Array.from(new Set(wanted)).sort((a, b) => a - b);

  let prev = 0;
  for (const p of uniqueSorted) {
    if (prev && p - prev > 1) out.push("…");
    push(p);
    prev = p;
  }
  return out;
};

const Pagination = ({ page, lastPage, onChange, disabled = false }: Props) => {
  if (lastPage <= 1) return null;

  const go = (p: number) => {
    const clamped = Math.min(Math.max(1, p), lastPage);
    if (clamped !== page && !disabled) onChange(clamped);
  };

  return (
    <nav className="cp-pagination" aria-label="pagination">
      <button
        type="button"
        className="cp-page-btn"
        onClick={() => go(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="previous page"
      >
        ‹
      </button>

      {buildWindow(page, lastPage).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="cp-page-gap" aria-hidden>…</span>
        ) : (
          <button
            type="button"
            key={p}
            className={`cp-page-btn${p === page ? " active" : ""}`}
            onClick={() => go(p)}
            disabled={disabled}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className="cp-page-btn"
        onClick={() => go(page + 1)}
        disabled={disabled || page >= lastPage}
        aria-label="next page"
      >
        ›
      </button>
    </nav>
  );
};

export default Pagination;
