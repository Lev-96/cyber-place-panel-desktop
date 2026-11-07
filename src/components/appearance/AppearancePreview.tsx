import SessionCard, { CardFootAction, CardOverflow, SessionCardAction } from "@/components/sessions/SessionCard";
import SessionTimer from "@/components/sessions/SessionTimer";
import PadToggle from "@/components/sessions/PadToggle";
import {
  PAD_COUNT_STYLE, PAD_LINE_STYLE, SeatGrip, SeatNameLine, SeatPlatformLine, sessionTariffLine,
} from "@/components/sessions/seatParts";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useLang } from "@/i18n/LanguageContext";
import { SESSION_CELL_COLOR } from "@/domain/SessionCellState";
import { PC_STATUS } from "@/types/pc";
import type { ISessionApi } from "@/types/sessions";
import type { ActionIconId } from "@/components/sessions/ActionIcon";
import { installBoardFit, useBoardFitOptions } from "@/preferences/FitBoardToScreen";
import { useEffect, useRef, useState } from "react";

/**
 * A picture of Active Places in the look being chosen (2026-10-27; rebuilt
 * 2026-11-03 from the board's OWN parts).
 *
 * Every seat is drawn by the same components the board draws it with —
 * `SessionCard` (frame, stripe, state, urgency colour), `SeatGrip`,
 * `SeatPlatformLine`, `SeatNameLine`, `SessionTimer`, the tariff line,
 * `PadToggle`, `SessionCardAction`, `CardOverflow` — inside the board's own
 * section and grid, so density, card size, list or grid, columns, spacing,
 * size, the «Ещё» fold, details and the theme show here exactly as they will
 * there. A test pins its structure to the real board's.
 *
 * It is a picture and nothing more: sample seats made up here, no handlers,
 * the whole grid `inert` and out of the tab order. It reads no data and sends
 * nothing; choosing a look can never start a seat, sell a drink or wake a
 * console.
 */
const noop = () => {};

interface Sample {
  no: number;
  name: string;
  tier: string;
  /** Minutes left on a running seat; undefined = a free seat. */
  minutesLeft?: number;
}

/**
 * The seats repeat this pattern (running, about to end, free…), numbered on.
 */
const PATTERN: ReadonlyArray<Omit<Sample, "no" | "name">> = [
  { tier: "STANDARD", minutesLeft: 40 },
  { tier: "VIP", minutesLeft: 4 },
  { tier: "STANDARD" },
  { tier: "STANDARD" },
  { tier: "STANDARD", minutesLeft: 25 },
  { tier: "VIP", minutesLeft: 55 },
];
/** The most seats a preview ever draws: two rows of the widest grid. */
const MAX_SEATS = 24;
const SAMPLES: readonly Sample[] = Array.from({ length: MAX_SEATS }, (_, i) => ({
  no: i + 1, name: `Hall ${i + 1}`, ...PATTERN[i % PATTERN.length],
}));

/**
 * How many seats to draw for a grid of `columns` (2026-11-05): two full rows,
 * so the space between rows — a setting of its own — is always seen, on any
 * screen width and card size. Four when there are no columns to read (a list,
 * or nothing laid out yet).
 */
export const previewSeatCount = (columns: number): number =>
  Math.min(MAX_SEATS, Math.max(4, columns * 2));

/** The columns a grid really has, as the browser laid it out (0 for none). */
const columnsOf = (grid: HTMLElement): number => {
  const tracks = getComputedStyle(grid).gridTemplateColumns;
  return !tracks || tracks === "none" ? 0 : tracks.trim().split(/\s+/).length;
};

/** A running sample session, fixed once: an hourly plan, a PlayStation's pads. */
const sampleSession = (id: number, minutesLeft: number, now: number): ISessionApi => ({
  id,
  branch_id: 0,
  pc_id: id,
  mode: "fixed",
  started_at: new Date(now - 20 * 60_000).toISOString(),
  ends_at: new Date(now + minutesLeft * 60_000).toISOString(),
  status: "active",
  hourly_rate: 800,
  committed_amount: 1600,
  package_name: null,
  total_paid: 0,
  joystick_count: 2,
  joysticks: [],
  is_free: false,
  is_unlimited: false,
  supports_joysticks: true,
  place_platform: "ps5",
} as unknown as ISessionApi);

/**
 * The preview at Active Places' OWN size, pixel for pixel (owner, 2026-11-03).
 * Its frame is narrower than the board (the settings card's padding and its
 * own), and a grid's columns and a row's words-or-pictures follow the board's
 * width, so it is laid out at the BOARD's width (the same screen width Active
 * Places has) and fitted by the board's own fitter with the board's own
 * options: the same columns, the same rows, the same pictures, the same zoom
 * where the board needs one. What the frame cannot show scrolls sideways
 * inside it. Null when the frame is already as wide.
 */
export const previewWidth = (frameWidth: number, boardWidth: number): number | null =>
  frameWidth > 0 && boardWidth > frameWidth ? boardWidth : null;

const AppearancePreview = ({ quick }: { quick: "all" | "primary" }) => {
  const { t, money } = useLang();
  // Made once: the sample clocks run like the board's, from a fixed start.
  const [sessions] = useState(() => {
    const now = Date.now();
    return SAMPLES.map((s, i) => (s.minutesLeft === undefined ? undefined : sampleSession(i + 1, s.minutesLeft, now)));
  });
  // The board's width is this screen's content width (both are ScreenWithBg).
  const frameRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const frame = frameRef.current;
    const screen = frame?.closest<HTMLElement>(".screen-bg-content");
    if (!frame || !screen || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setWidth(previewWidth(frame.clientWidth, screen.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(screen);
    return () => ro.disconnect();
  }, []);
  // The board's own fit (pictures, then zoom), for the look being chosen.
  const fitOptions = useBoardFitOptions();
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !fitOptions.list) return undefined;
    return installBoardFit(board);
  }, [fitOptions.list, fitOptions.look, width]);
  // Two rows of the grid as it is laid out now: re-read when the grid's
  // width or the look (card size, density, list or grid) changes.
  const [count, setCount] = useState(() => previewSeatCount(0));
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const read = () => setCount(previewSeatCount(fitOptions.list ? 0 : columnsOf(grid)));
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [fitOptions.list, fitOptions.look, width]);
  const seats = SAMPLES.slice(0, count);
  const fake = (action: ActionIconId, label: string, full: string, extra: { wide?: boolean; danger?: boolean } = {}) => (
    <SessionCardAction data-action={action} icon={action} label={label} fullLabel={full} tabIndex={-1} type="button" {...extra} />
  );

  return (
    <div className="appearance-preview" aria-label={t("appearance.preview")} role="img" data-testid="appearance-preview">
      <div ref={frameRef} className="appearance-preview__frame">
      <div ref={boardRef} inert style={width ? { width } : undefined} data-testid="appearance-preview-board">
        <CollapsibleSection title={t("session.groupPs")} count={seats.length} open onToggle={noop}>
          <div ref={gridRef} className="live-grid live-grid--sessions">
            {seats.map((s, i) => {
              const sess = sessions[i];
              return (
                <SessionCard
                  key={s.no}
                  session={sess}
                  baseColor={SESSION_CELL_COLOR[sess ? "busy" : "free"]}
                  seatState={sess ? "busy" : "free"}
                  stateLabel={(tone) => t(`session.tone.${tone}`)}
                >
                  <SeatGrip label={t("session.dragToReorder")} />
                  <SeatPlatformLine deviceStatus={PC_STATUS.Online} platformName="PS5" tierName={s.tier} />
                  <SeatNameLine text={`№${s.no} · ${s.name}`} />
                  {sess ? (
                    <>
                      <span className="status">
                        <SessionTimer session={sess} formatMoney={money} reset={{ label: t("session.reset.button"), onReset: noop }} />
                      </span>
                      <span className="until">
                        <span className="session-card__secondary">{sessionTariffLine(sess, money, t)}</span>
                      </span>
                      {/* The pad line every PlayStation seat carries, empty: no extra pad out. */}
                      <span className="row" style={PAD_LINE_STYLE}>
                        <span className="row" style={PAD_COUNT_STYLE} />
                      </span>
                      <div className="session-card__actions">
                        <PadToggle next={null} extrasOut={0} busy={false} onAdd={noop} onRemove={noop} />
                        {fake("add-item", t("session.card.addItem"), t("session.addItem"))}
                        <CardOverflow collapsed={quick === "primary"} label={t("session.card.more")}>
                          {fake("add-time", t("session.card.addTime"), t("session.addTime"))}
                          {fake("pause", t("session.pause"), t("session.pause"))}
                          {fake("relocate", t("session.card.relocate"), t("session.relocate"), { wide: true })}
                        </CardOverflow>
                        {fake("stop", t("action.stop"), t("action.stop"), { danger: true })}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="status">{t("session.free")}</span>
                      <div className="session-card__foot">
                        {/* Start and «Забронировать», as a free seat on the board (2026-11-07). */}
                        <div className="session-card__reserve-actions">
                          <CardFootAction type="button" icon="start" label={t("action.start")} className="session-card__start" data-action="start" tabIndex={-1} />
                          <CardFootAction type="button" icon="reserve" variant="secondary" label={t("reserve.buttonShort")} fullLabel={t("reserve.button")} data-action="reserve" tabIndex={-1} />
                        </div>
                      </div>
                    </>
                  )}
                </SessionCard>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>
      </div>
    </div>
  );
};

export default AppearancePreview;
