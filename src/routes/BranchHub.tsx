import { GridSkeleton } from "@/components/ui/Skeleton";
import { BackAction, ErrorState, classifyError } from "@/components/ui/state";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BlockToggle from "@/components/blocking/BlockToggle";
import BranchStatusPill from "@/components/branches/BranchStatusPill";
import { BRANCH_SECTIONS, branchSectionPath } from "@/components/branches/branchSections";
import BranchLiveScreen from "@/components/live/BranchLiveScreen";
import Avatar from "@/components/ui/Avatar";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLocalReorder } from "@/hooks/useLocalReorder";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useAccessVersion } from "@/realtime/accessVersion";
import { branchRepository } from "@/repositories/BranchRepository";
import { isBranchInactive } from "@/types/branch";
import { billingAccessOf } from "@/types/platformBilling";
import NavIcon from "@/components/ui/NavIcon";
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

/**
 * The banner for a branch whose company has an unpaid platform invoice, or
 * null when it is fully open (or the backend predates the field).
 */
export const billingAccessNoticeKey = (access: unknown): string | null => {
  const a = billingAccessOf(access);
  return a === "active" ? null : `billingAccess.banner.${a}`;
};

interface TileDef {
  key: string;
  /** The section's NavIcon id (the same shape its menu shortcut draws). */
  icon: string;
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
  // Inactive = invisible to players, yet fully workable for staff, so it
  // explains itself without disabling anything. Owner and admin read the same
  // sentence — either of them can switch it — plus where the switch is; a
  // manager, who cannot, gets the sentence alone.
  const inactive = isBranchInactive(data?.status);
  const inactiveNotice = can(role, "branch.status")
    ? `${t("branch.inactive.notice")} ${fmt(
        t("branch.inactive.noticeWhere"),
        t("hub.tile.settings"),
        t("branchEdit.editInfo"),
        t("branch.status.active"),
      )}`
    : t("branch.inactive.notice");
  // An unpaid Cyber Place Platform invoice limits NEW work here (2026-11-09):
  // say what is limited and that running seats carry on. Only the sentence;
  // the tiles stay live, because stopping, paying and adding time all still
  // work, and the server refuses exactly the gated writes with its own message.
  const billingNoticeKey = billingAccessNoticeKey(data?.billing_access);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  // Every tile the branch offers, gated by role. Order is a per-device UI
  // preference (useLocalReorder), so staff can arrange the hub to taste
  // without any backend change.
  const tiles: TileDef[] = BRANCH_SECTIONS.map((section) => ({
    key: section.key,
    icon: section.icon,
    to: branchSectionPath(section, id),
    title: t(section.titleKey),
    hint: t(section.hintKey),
    show: section.allowed(role),
  }));
  const visible = tiles.filter((x) => x.show);
  const byKey = new Map(visible.map((x) => [x.key, x] as const));
  const reorder = useLocalReorder(`hub:tiles:${id}`, visible.map((x) => x.key));
  const ordered = reorder.ordered.map((k) => byKey.get(k)).filter((x): x is TileDef => !!x);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  // No such branch: nothing below (its tiles, its live board) has anything to
  // show, so the page is the not-found state alone.
  if (error && !data && classifyError(error) === "notFound") {
    return (
      <ScreenWithBg bg="./bg/branch.jpg" title={`${t("hub.branchFallback")} №${id}`}>
        <ErrorState
          error={error}
          notFoundTitleKey="branch.state.notFoundTitle"
          notFoundDescriptionKey="branch.state.notFoundDescription"
          notFoundAction={<BackAction fallback="/branches" />}
        />
      </ScreenWithBg>
    );
  }

  const onDrop = (key: string) => {
    const from = dragKey;
    setDragKey(null);
    setDropKey(null);
    if (!from || from === key) return;
    reorder.move(from, key);
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={data ? `${data.company?.name ?? t("hub.branchFallback")} · ${data.address}` : `${t("hub.branchFallback")} №${id}`}>
      {/* Skeleton only before the first answer: a background re-read (an
          access change) must not blank the header the operator is reading. */}
      {loading && !data && <GridSkeleton cells={6} />}
      {error && !data && (
        <ErrorState
          size="section"
          error={error}
          onRetry={() => void reload()}
          titleKey="branch.state.errorTitle"
          notFoundTitleKey="branch.state.notFoundTitle"
          notFoundDescriptionKey="branch.state.notFoundDescription"
          notFoundAction={<BackAction fallback="/branches" />}
        />
      )}

      {data && (
        /* Wrapping header (see `.entity-header` in global.css): the address,
           the state badge and the block control are all variable-width, so the
           row reflows instead of squeezing the name into a column of single
           words when the window is narrow. */
        <div className="entity-header">
          <Avatar src={data.branch_logo_path} name={data.address} size={72} />
          <div className="entity-header__identity">
            <div className="entity-header__title">
              <span>{data.address}</span>
              {/* State before action: an admin arriving at a closed branch
                  should read WHY it is closed, not infer it from which button
                  they are being offered. A sibling of the name rather than
                  text inside it, so a long badge wraps as a whole. */}
              {data.is_blocked && (
                <span className="pill blocked">
                  {data.blocked_at ? t("blocking.state.branch") : t("blocking.state.byCompany")}
                </span>
              )}
              {/* Always drawn: an active branch is labelled Active too. Only
                  an inactive one also gets the notice below. */}
              <BranchStatusPill status={data.status} />
            </div>
            <div className="muted">{data.company?.name ?? ""} · {data.country}, {data.city}</div>
          </div>
          {/* Admin-only — renders nothing for owners and managers. Re-reads the
              branch afterwards so the badge and the button always agree. The
              wrapper stacks the button with the note underneath it; side by
              side they were competing with the address for the same width. */}
          <div className="entity-header__actions">
            <BlockToggle
              kind="branch"
              id={id}
              name={data.address}
              blockedAt={data.blocked_at}
              isBlocked={data.is_blocked}
              onChanged={() => void reload()}
            />
          </div>
        </div>
      )}

      {/* State before consequence: read WHY the tiles below are grey, in one
          sentence, before meeting them. */}
      {readOnly && (
        <div className="card state-notice" role="status">
          {readOnlyNotice}
        </div>
      )}
      {inactive && (
        <div className="card state-notice" role="status">
          {inactiveNotice}
        </div>
      )}
      {billingNoticeKey && (
        <div className="card state-notice" role="status" data-billing-access={data?.billing_access}>
          {t(billingNoticeKey)}
          {can(role, "revenue.view") && role !== "admin" && <> {t("billingAccess.banner.ownerAction")}</>}
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
            icon={tile.icon}
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
  icon: string;
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
const Tile = ({ icon, to, title, hint, disabled, disabledHint, dragHint, dragging, dropTarget, onDragStart, onDragEnd, onDragOver, onDrop }: TileProps) => (
  <Link
    to={to}
    className={`card hub-tile${disabled ? " is-disabled" : ""}`}
    draggable={false}
    aria-disabled={disabled || undefined}
    title={disabled ? disabledHint : undefined}
    aria-label={disabled ? `${title}: ${disabledHint}` : undefined}
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
      borderColor: dropTarget ? "var(--color-primary)" : undefined,
      boxShadow: dropTarget ? "0 0 0 2px rgb(var(--accent-rgb) / 0.5), 0 0 18px rgb(var(--accent-rgb) / 0.3)" : undefined,
      transition: "opacity 140ms ease, box-shadow 200ms ease, border-color 160ms ease",
    }}
  >
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={dragHint}
      aria-label={dragHint}
      style={{ position: "absolute", top: 6, right: 8, cursor: "grab", userSelect: "none", color: "var(--color-muted-alt)", opacity: 0.6, fontSize: 13, lineHeight: 1 }}
    >
      ⠿
    </span>
    <div className="hub-tile__title" style={{ color: disabled ? "var(--color-muted-alt)" : "var(--color-primary)" }}>
      <NavIcon id={icon} />
      <span className="hub-tile__label">{title}</span>
    </div>
    <div className="muted" style={{ fontSize: 12, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{hint}</div>
  </Link>
);

export default BranchHub;
