import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { notify } from "@/ui/notify";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { IRelocationOptions, IRelocationPlace } from "@/api/sessions";
import { ISessionApi } from "@/types/sessions";
import { platformLabel } from "@/utils/platform";
import { useCallback, useEffect, useState } from "react";

interface Props {
  session: ISessionApi;
  onClose: () => void;
  /** The session the server returned after the move — same id, new seat. */
  onMoved: (session: ISessionApi, from: { pcId: number }) => void;
}

/** 24-hour wall clock, the only format this panel shows a time in. */
const clockOf = (at: string): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const seatOf = (p: { number: number | null; place_id?: number | null; name?: string | null }): string =>
  `№${p.number ?? p.place_id ?? "-"}${p.name ? ` · ${p.name}` : ""}`;

/**
 * «Переместить игрока» — move a running session to another seat.
 *
 * ## Nothing here decides anything
 *
 * The seats, their rates, whether a rate matches the session's, and when a
 * reservation would cut the session short all come from the server
 * (`relocation-options`). The confirm re-checks every one of them under a lock:
 * a seat taken or newly reserved while this was open is refused and the list
 * is drawn again. A limited seat is sent with the limit the operator was SHOWN,
 * so a limit that has since moved is refused rather than silently accepted.
 *
 * The price shown by default is the new seat's own; "Change price" names
 * another, validated again on the server. Either way only the time AFTER the
 * move runs at it — the server freezes what was already played.
 */
const RelocateSessionDialog = ({ session, onClose, onMoved }: Props) => {
  const { t, money } = useLang();
  const [options, setOptions] = useState<IRelocationOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overrideOn, setOverrideOn] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [limitAccepted, setLimitAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setOptions(await sessionRepository.relocationOptions(session.id));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [session.id]);

  useEffect(() => { void load(); }, [load]);

  const selected: IRelocationPlace | null =
    options?.places.find((p) => p.place_id === selectedId) ?? null;

  const choose = (placeId: number) => {
    setSelectedId(placeId);
    setLimitAccepted(false);
    setError(null);
  };

  /** A price, or null when the box does not hold one. Zero is refused, as on the server. */
  const typedRate = ((): number | null => {
    const raw = rateInput.trim().replace(",", ".");
    if (raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 && value <= 99_999_999.99 ? value : null;
  })();

  const effectiveRate = selected === null ? null : overrideOn ? typedRate : selected.hourly_rate;
  const canConfirm =
    !busy && selected !== null && effectiveRate !== null && (selected.free_until === null || limitAccepted);

  const confirm = async () => {
    if (!selected || !canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await sessionRepository.relocate(session.id, {
        place_id: selected.place_id,
        ...(overrideOn && typedRate !== null ? { hourly_rate: typedRate } : {}),
        ...(selected.free_until !== null ? { until: selected.free_until } : {}),
      });
      notify.message("success", fmt(t("session.relocatedToast"), seatOf(selected)));
      onMoved(updated, { pcId: session.pc_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // The world moved while the dialog was open: say so, and draw the list
      // again rather than let the operator retry an answer the server refused.
      if ((e as { status?: number }).status === 409) {
        notify.warning(fmt(t("session.moveTakenToast"), seatOf(selected)));
        setSelectedId(null);
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const sameRate = options?.places.filter((p) => p.same_rate) ?? [];
  const others = options?.places.filter((p) => !p.same_rate) ?? [];

  const card = (p: IRelocationPlace) => {
    const chosen = selectedId === p.place_id;
    return (
      <button
        key={p.place_id}
        type="button"
        className="card"
        aria-pressed={chosen}
        disabled={busy}
        onClick={() => choose(p.place_id)}
        style={{
          textAlign: "left", cursor: "pointer", padding: 12, display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 12,
          borderColor: chosen ? "var(--color-primary)" : "var(--color-border)",
          borderWidth: chosen ? 2 : 1,
        }}
      >
        <span className="col" style={{ gap: 3, minWidth: 0 }}>
          <strong>{seatOf(p)}</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {[p.platform ? platformLabel(p.platform) : null, p.type].filter(Boolean).join(" · ")}
          </span>
          {p.free_until !== null ? (
            <span style={{ fontSize: 12, color: "var(--color-warning)" }}>
              {fmt(t("session.relocateLimited"), clockOf(p.free_until), p.free_minutes ?? 0)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--color-success)" }}>{t("session.moveAvailable")}</span>
          )}
        </span>
        <span className="col" style={{ gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
          <span className="muted">{money(p.hourly_rate)} / {t("time.hourShort") || "h"}</span>
          {chosen && <span style={{ color: "var(--color-primary)", fontSize: 12 }}>✓ {t("session.moveChosen")}</span>}
        </span>
      </button>
    );
  };

  const current = options?.current;

  return (
    <Modal open onClose={onClose} dirty={selectedId !== null}>
      <div className="card col" style={{ gap: 16, width: 480, maxWidth: "92vw" }}>
        <div className="row-between" style={{ alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{t("session.relocate")}</h2>
          <span className="muted" style={{ fontSize: 13 }}>{session.pc_label}</span>
        </div>

        {loadError !== null && <span className="error">{loadError}</span>}
        {options === null && loadError === null && <Spinner />}

        {current && (
          <div className="col" style={{ gap: 4, fontSize: 13 }}>
            <span className="muted">
              {t("session.moveFromLabel")}{" "}
              <strong style={{ color: "var(--color-text)" }}>{seatOf(current)}</strong>
              {current.type ? ` · ${current.type}` : ""}
            </span>
            {current.hourly_rate !== null && (
              <span className="muted">
                {t("session.relocateCurrentRate")}{" "}
                <strong style={{ color: "var(--color-text)" }}>{money(current.hourly_rate)} / {t("time.hourShort") || "h"}</strong>
              </span>
            )}
          </div>
        )}

        {options !== null && options.places.length === 0 && (
          <span className="muted" style={{ fontSize: 13 }}>{t("session.relocateNone")}</span>
        )}

        {sameRate.length > 0 && (
          <section className="col" style={{ gap: 8 }}>
            <strong style={{ fontSize: 13 }}>{t("session.relocateSameRate")}</strong>
            {sameRate.map(card)}
          </section>
        )}
        {others.length > 0 && (
          <section className="col" style={{ gap: 8 }}>
            <strong style={{ fontSize: 13 }}>{t("session.relocateOtherRate")}</strong>
            {others.map(card)}
          </section>
        )}

        {selected && (
          <section className="col" style={{ gap: 10, paddingTop: 4, borderTop: "1px solid var(--color-border)" }}>
            <Checkbox
              checked={overrideOn}
              onChange={(on) => { setOverrideOn(on); if (on && rateInput === "") setRateInput(String(selected.hourly_rate)); }}
              disabled={busy}
              label={t("session.relocateChangePrice")}
            />
            {overrideOn && (
              <label className="col" style={{ gap: 4, paddingLeft: 26 }}>
                <div className="row" style={{ gap: 6, alignItems: "center" }}>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    aria-label={t("session.relocateChangePrice")}
                    style={{ width: 140 }}
                    autoFocus
                  />
                  <span className="muted" style={{ fontSize: 12 }}>/ {t("time.hourShort") || "h"}</span>
                </div>
                {rateInput.trim() !== "" && typedRate === null && (
                  <span className="error" style={{ fontSize: 12 }}>{t("session.unlimitedRateInvalid")}</span>
                )}
              </label>
            )}

            {selected.free_until !== null && (
              <Checkbox
                checked={limitAccepted}
                onChange={setLimitAccepted}
                disabled={busy}
                label={fmt(t("session.relocateAcceptLimit"), clockOf(selected.free_until))}
              />
            )}

            {/* The summary: where, at what price, and that the past keeps its own. */}
            <div className="col" style={{ gap: 4, fontSize: 13 }}>
              <span>
                {current ? seatOf(current) : session.pc_label} <span aria-hidden style={{ color: "var(--color-primary)" }}>-&gt;</span>{" "}
                <strong>{seatOf(selected)}</strong>
              </span>
              {effectiveRate !== null && (
                <span className="muted">
                  {fmt(t("session.relocateSummaryRate"), `${money(effectiveRate)} / ${t("time.hourShort") || "h"}`)}
                </span>
              )}
              <span className="muted" style={{ fontSize: 12 }}>{t("session.relocateSummaryKept")}</span>
            </div>
          </section>
        )}

        {error !== null && <span className="error" style={{ fontSize: 13 }}>{error}</span>}

        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button variant="primary" onClick={() => { void confirm(); }} disabled={!canConfirm}>
            {t("session.relocateConfirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RelocateSessionDialog;
