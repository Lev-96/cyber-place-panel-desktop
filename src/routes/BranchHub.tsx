import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BlockToggle from "@/components/blocking/BlockToggle";
import BranchLiveScreen from "@/components/live/BranchLiveScreen";
import Avatar from "@/components/ui/Avatar";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLocalReorder } from "@/hooks/useLocalReorder";
import { useLang } from "@/i18n/LanguageContext";
import { useAccessVersion } from "@/realtime/accessVersion";
import { branchRepository } from "@/repositories/BranchRepository";
import { DragEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";

/**
 * Is this branch read-only for the person looking at it?
 *
 * Exported so the rule is testable on its own and cannot drift from what the
 * server enforces: staff of a closed branch may read it and change nothing,
 * while an admin — who closed it and may reopen it from this very page — keeps
 * working inside it.
 */
export const isBranchReadOnly = (role: string | undefined, isBlocked: boolean | undefined): boolean =>
  !!isBlocked && role !== "admin";

/**
 * Which explanation the read-only banner carries.
 *
 * A branch closed by its COMPANY cannot be reopened by unblocking the branch,
 * so telling its owner "this branch is blocked" would send them to ask the
 * wrong question. `blocked_at` is what separates the two: set = its own block,
 * absent while still blocked = inherited from the company.
 */
export const readOnlyNoticeKey = (blockedAt: string | null | undefined): string =>
  blockedAt ? "blocking.readOnly.banner" : "blocking.readOnly.bannerByCompany";

interface TileDef {
  key: string;
  to: string;
  title: string;
  hint: string;
  show: boolean;
}

const BranchHub = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { user } = useAuth();
  const role = user?.role;
  // Re-read when an administrator blocks or unblocks: this screen's whole
  // shape (banner, dead tiles) is derived from `is_blocked`, and a reopened
  // branch that stays grey until a manual reload is the same bug as an open
  // one that never closed.
  const access = useAccessVersion();
  const { data, loading, error, reload } = useAsync(() => branchRepository.byId(id), [id, access]);

  /*
   * A branch an administrator has closed is READ-ONLY for its owner and its
   * managers: they may open it and look at it — the state, the live board, the
   * reason it is closed all live here — and every section behind these tiles is
   * shut, exactly as the server refuses every write into it.
   *
   * An admin is exempt: they closed it, they may still work inside it, and
   * this is the page the block is lifted from.
   */
  const readOnly = isBranchReadOnly(role, data?.is_blocked);
  // `blocked_at` set = this branch's own block; null while `is_blocked` = it is
  // closed because its company is. Two different sentences, because only one of
  // them can be undone by unblocking the branch.
  const readOnlyNotice = t(readOnlyNoticeKey(data?.blocked_at));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  // Every tile the branch offers, gated by role. Order is a per-device UI
  // preference (useLocalReorder), so staff can arrange the hub to taste
  // without any backend change.
  const tiles: TileDef[] = [
    { key: "sessions", to: `/branches/${id}/sessions`, title: t("hub.tile.sessions"), hint: t("hub.tile.sessionsHint"), show: true },
    { key: "pos", to: `/branches/${id}/pos`, title: t("hub.tile.pos"), hint: t("hub.tile.posHint"), show: true },
    { key: "shift", to: `/branches/${id}/shift`, title: t("hub.tile.shift"), hint: t("hub.tile.shiftHint"), show: true },
    { key: "members", to: `/branches/${id}/members`, title: t("hub.tile.members"), hint: t("hub.tile.membersHint"), show: true },
    { key: "places", to: `/branches/${id}/places`, title: t("hub.tile.places"), hint: t("hub.tile.placesHint"), show: true },
    { key: "games", to: `/branches/${id}/games`, title: t("hub.tile.games"), hint: t("hub.tile.gamesHint"), show: can(role, "game.crud.branch") },
    { key: "pcs", to: `/branches/${id}/pcs`, title: t("hub.tile.pcs"), hint: t("hub.tile.pcsHint"), show: true },
    { key: "tariffs", to: `/branches/${id}/tariffs`, title: t("hub.tile.prices"), hint: t("hub.tile.pricesHint"), show: can(role, "branch.prices") },
    { key: "products", to: `/branches/${id}/products`, title: t("hub.tile.products"), hint: t("hub.tile.productsHint"), show: true },
    { key: "managers", to: `/branches/${id}/managers`, title: t("hub.tile.managers"), hint: t("hub.tile.managersHint"), show: can(role, "manager.create") },
    { key: "tournaments", to: `/branches/${id}/tournaments`, title: t("hub.tile.tournaments"), hint: t("hub.tile.tournamentsHint"), show: true },
    { key: "subscribers", to: `/branches/${id}/subscribers`, title: t("hub.tile.subscribers"), hint: t("hub.tile.subscribersHint"), show: true },
    { key: "edit", to: `/branches/${id}/edit`, title: t("hub.tile.settings"), hint: t("hub.tile.settingsHint"), show: true },
  ];
  const visible = tiles.filter((x) => x.show);
  const byKey = new Map(visible.map((x) => [x.key, x] as const));
  const reorder = useLocalReorder(`hub:tiles:${id}`, visible.map((x) => x.key));
  const ordered = reorder.ordered.map((k) => byKey.get(k)).filter((x): x is TileDef => !!x);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const onDrop = (key: string) => {
    const from = dragKey;
    setDragKey(null);
    setDropKey(null);
    if (!from || from === key) return;
    reorder.move(from, key);
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={data ? `${data.company?.name ?? t("hub.branchFallback")} · ${data.address}` : `${t("hub.branchFallback")} №${id}`}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}

      {data && (
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          <Avatar src={data.branch_logo_path} name={data.address} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {data.address}
              {/* State before action: an admin arriving at a closed branch
                  should read WHY it is closed, not infer it from which button
                  they are being offered. */}
              {data.is_blocked && (
                <span className="pill blocked" style={{ marginLeft: 8, fontSize: 12 }}>
                  {data.blocked_at ? t("blocking.state.branch") : t("blocking.state.byCompany")}
                </span>
              )}
            </div>
            <div className="muted">{data.company?.name ?? ""} · {data.country}, {data.city}</div>
          </div>
          {/* Admin-only — renders nothing for owners and managers. Re-reads the
              branch afterwards so the badge and the button always agree. */}
          <BlockToggle
            kind="branch"
            id={id}
            name={data.address}
            blockedAt={data.blocked_at}
            isBlocked={data.is_blocked}
            onChanged={() => void reload()}
          />
        </div>
      )}

      {/* State before consequence: read WHY the tiles below are grey, in one
          sentence, before meeting them. */}
      {readOnly && (
        <div
          className="card"
          role="status"
          style={{
            width: "100%",
            borderColor: "#f0a202",
            background: "rgba(240,162,2,0.08)",
            color: "#ffd88a",
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          {readOnlyNotice}
        </div>
      )}

      <div
        className="row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          width: "100%",
        }}
      >
        {ordered.map((tile) => (
          <Tile
            key={tile.key}
            to={tile.to}
            title={tile.title}
            hint={tile.hint}
            disabled={readOnly}
            disabledHint={t("blocking.readOnly.tileHint")}
            dragHint={t("session.dragSectionHint")}
            dragging={dragKey === tile.key}
            dropTarget={dropKey === tile.key && dragKey != null && dragKey !== tile.key}
            onDragStart={(e) => {
              const card = (e.currentTarget as HTMLElement).closest(".hub-tile");
              if (card) e.dataTransfer.setDragImage(card, 24, 24);
              setDragKey(tile.key);
            }}
            onDragEnd={() => { setDragKey(null); setDropKey(null); }}
            onDragOver={(e) => { e.preventDefault(); if (dragKey && dragKey !== tile.key) setDropKey(tile.key); }}
            onDrop={() => onDrop(tile.key)}
          />
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <BranchLiveScreen branchId={id} />
      </div>
    </ScreenWithBg>
  );
};

interface TileProps {
  to: string;
  title: string;
  hint: string;
  /** Branch is out of service — the section behind this tile is closed too. */
  disabled: boolean;
  /** Why it is unavailable, shown on hover and to a screen reader. */
  disabledHint: string;
  dragHint: string;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

/**
 * A section of the branch.
 *
 * While the branch is blocked every tile is rendered as an inert card instead
 * of a link: the section is closed, and offering a link that bounces the
 * operator straight back reads as a broken panel rather than as a decision an
 * administrator made. The reason travels with the tile (title + aria-label) so
 * a greyed-out card is never a mystery.
 */
const Tile = ({ to, title, hint, disabled, disabledHint, dragHint, dragging, dropTarget, onDragStart, onDragEnd, onDragOver, onDrop }: TileProps) => (
  <Link
    to={to}
    className={`card hub-tile${disabled ? " is-disabled" : ""}`}
    draggable={false}
    aria-disabled={disabled || undefined}
    title={disabled ? disabledHint : undefined}
    aria-label={disabled ? `${title} — ${disabledHint}` : undefined}
    tabIndex={disabled ? -1 : undefined}
    onClick={disabled ? (e) => e.preventDefault() : undefined}
    onDragOver={onDragOver}
    onDrop={onDrop}
    style={{
      position: "relative",
      height: 84,
      textDecoration: "none",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 4,
      opacity: disabled ? 0.45 : dragging ? 0.5 : 1,
      cursor: disabled ? "not-allowed" : undefined,
      filter: disabled ? "grayscale(1)" : undefined,
      borderColor: dropTarget ? "#07ddf1" : undefined,
      boxShadow: dropTarget ? "0 0 0 2px rgba(7,221,241,0.5), 0 0 18px rgba(7,221,241,0.3)" : undefined,
      transition: "opacity 140ms ease, box-shadow 200ms ease, border-color 160ms ease",
    }}
  >
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={dragHint}
      aria-label={dragHint}
      style={{ position: "absolute", top: 6, right: 8, cursor: "grab", userSelect: "none", color: "#9aa8c7", opacity: 0.6, fontSize: 13, lineHeight: 1 }}
    >
      ⠿
    </span>
    <div style={{ fontWeight: 700, fontSize: 16, color: disabled ? "#9aa8c7" : "#07ddf1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 18 }}>{title}</div>
    <div className="muted" style={{ fontSize: 12, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{hint}</div>
  </Link>
);

export default BranchHub;
