import { apiCaptchaChallenge, apiCaptchaVerify, CaptchaClient, ICaptchaChallenge } from "@/api/captcha";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

interface Props {
  client: CaptchaClient;
  /** The one-time pass, once the picture is whole (after the success animation). */
  onSolved: (token: string) => void;
}

type Phase = "loading" | "ready" | "checking" | "solved" | "wrong" | "failed";

/** How long the "solved" moment stays on screen before the sign-in carries on. */
const SOLVED_MS = 650;
/** How long the "wrong" shake plays before the next picture comes in. */
const WRONG_MS = 450;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The sign-in mosaic (2026-10-07), shared by the desktop and the owner web: a
 * photo cut into a 3×3 grid, shuffled. Tap a tile, then another, and they
 * swap; "Check" sends the order once. The server keeps the answer and allows
 * one try per picture, so a wrong answer brings a new picture, and "New
 * picture" tells the server to forget the old one.
 *
 * Keyboard: arrows move between tiles, Enter or Space picks one and then swaps
 * it with the next one picked. Under reduced motion the swaps, the success
 * moment and the shake are instant.
 */
const MosaicCaptcha = ({ client, onSolved }: Props) => {
  const { t } = useLang();
  const [challenge, setChallenge] = useState<ICaptchaChallenge | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [notice, setNotice] = useState<"wrong" | "failed" | null>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const alive = useRef(true);
  const loading = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async (replaces?: string) => {
    if (loading.current) return;
    loading.current = true;
    setPhase("loading");
    setPicked(null);
    try {
      const next = await apiCaptchaChallenge(client, replaces);
      if (!alive.current) return;
      setChallenge(next);
      setOrder(Array.from({ length: next.grid * next.grid }, (_, i) => i));
      setPhase("ready");
    } catch {
      if (!alive.current) return;
      setChallenge(null);
      setNotice("failed");
      setPhase("failed");
    } finally {
      loading.current = false;
    }
  }, [client]);

  useEffect(() => { void load(); }, [load]);

  const busy = phase !== "ready";
  const grid = challenge?.grid ?? 3;

  const pick = (position: number) => {
    if (busy) return;
    setNotice(null);
    if (picked === null) {
      setPicked(position);
      return;
    }
    if (picked !== position) {
      setOrder((current) => {
        const next = [...current];
        [next[picked], next[position]] = [next[position], next[picked]];
        return next;
      });
    }
    setPicked(null);
  };

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, position: number) => {
    const row = Math.floor(position / grid);
    const col = position % grid;
    const moves: Record<string, number> = {
      ArrowLeft: col > 0 ? position - 1 : position,
      ArrowRight: col < grid - 1 ? position + 1 : position,
      ArrowUp: row > 0 ? position - grid : position,
      ArrowDown: row < grid - 1 ? position + grid : position,
    };
    if (e.key in moves) {
      e.preventDefault();
      tileRefs.current[moves[e.key]]?.focus();
    }
  };

  const check = async () => {
    if (!challenge || busy) return;
    setPhase("checking");
    setPicked(null);
    try {
      const { captcha_token } = await apiCaptchaVerify(client, challenge.id, order);
      if (!alive.current) return;
      setPhase("solved");
      window.setTimeout(() => { if (alive.current) onSolved(captcha_token); }, prefersReducedMotion() ? 0 : SOLVED_MS);
    } catch (e) {
      if (!alive.current) return;
      const code = (e as { body?: { code?: string } })?.body?.code;
      // A wrong answer and a spent or expired picture read the same; a network
      // or server failure is said as such. Either way this picture is gone.
      setNotice(code === "captcha_failed" ? "wrong" : "failed");
      setPhase("wrong");
      window.setTimeout(() => { if (alive.current) void load(); }, prefersReducedMotion() ? 0 : WRONG_MS);
    }
  };

  const tileSize = 100 / grid;

  return (
    <div className="mosaic" role="group" aria-labelledby="mosaic-title">
      <div className="mosaic__head">
        <div>
          <div id="mosaic-title" className="mosaic__title">{t("captcha.title")}</div>
          <div className="mosaic__hint">{t("captcha.hint")}</div>
        </div>
        <button
          type="button"
          className="mosaic__refresh"
          onClick={() => void load(challenge?.id)}
          disabled={phase === "loading" || phase === "checking" || phase === "solved"}
          aria-label={t("captcha.refresh")}
          title={t("captcha.refresh")}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        </button>
      </div>

      <div
        className={`mosaic__board is-${phase}`}
        aria-busy={phase === "loading" || phase === "checking" || undefined}
        style={{ ["--mosaic-grid" as string]: grid }}
      >
        {phase === "loading" || !challenge ? (
          phase === "failed" ? (
            <div className="mosaic__failed">
              <span>{t("captcha.loadFailed")}</span>
              <Button type="button" variant="secondary" onClick={() => void load()}>{t("captcha.retry")}</Button>
            </div>
          ) : (
            <div className="mosaic__skeleton cp-skeleton" aria-label={t("a11y.loading")} />
          )
        ) : (
          order.map((tile, position) => (
            <button
              key={tile}
              ref={(el) => { tileRefs.current[position] = el; }}
              type="button"
              className={`mosaic__tile${picked === position ? " is-picked" : ""}`}
              style={{
                backgroundImage: `url(${challenge.image})`,
                backgroundSize: `${grid * 100}% ${grid * 100}%`,
                backgroundPosition: `${(tile % grid) * (100 / (grid - 1))}% ${Math.floor(tile / grid) * (100 / (grid - 1))}%`,
                width: `${tileSize}%`,
                height: `${tileSize}%`,
                left: `${(position % grid) * tileSize}%`,
                top: `${Math.floor(position / grid) * tileSize}%`,
              }}
              aria-label={fmt(t("captcha.tile"), String(position + 1))}
              aria-pressed={picked === position}
              disabled={busy}
              onClick={() => pick(position)}
              onKeyDown={(e) => onTileKey(e, position)}
            />
          ))
        )}
        {phase === "solved" && (
          <div className="mosaic__done" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" focusable="false">
              <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
          </div>
        )}
      </div>

      <div className="mosaic__status" role="status" aria-live="polite">
        {phase === "solved" ? t("captcha.solved")
          : notice === "wrong" ? t("captcha.wrong")
          : notice === "failed" && phase !== "failed" ? t("captcha.loadFailed")
          : picked !== null ? t("captcha.pickedHint")
          : ""}
      </div>

      <Button type="button" className="mosaic__check" onClick={() => void check()} disabled={busy}>
        {phase === "checking" ? t("captcha.checking") : t("captcha.check")}
      </Button>
    </div>
  );
};

export default MosaicCaptcha;
