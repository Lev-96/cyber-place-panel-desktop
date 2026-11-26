/**
 * Cyber Place Club Card (2026-11-25) — mirrors the backend's
 * App\Http\Controllers\Bonus\BonusController payloads. Money comes as a
 * decimal string with two places, exactly as the server banks it.
 */
export interface IBonusSettings {
  enabled: boolean;
  /** 0..100, e.g. "5.00" */
  percent: string;
  /** What a new card starts with; "0.00" = none. */
  welcome: string;
  /** The hours whose games earn the percent ("10:00"); null = every hour. Absent from an older server. */
  earn_from?: string | null;
  earn_to?: string | null;
  /** Ranks (2026-11-25); absent from an older server. */
  rank?: IRankSettings;
  /** The time bonus (2026-11-25); absent from a server before it. */
  time_bonus?: ITimeBonusSettings;
  /** What the branch's players think of it (2026-11-26); absent from an older server. */
  rating?: IRating;
}

/** GAMER … LEGEND, lowest first — the server's `BonusRank::LADDER`. */
export const RANKS = ["gamer", "pro", "elite", "veteran", "legend"] as const;
export type Rank = (typeof RANKS)[number];
/** What moves a card up: none, hours played, days visited, money spent. */
export type RankStrategy = "none" | "hours" | "visits" | "spent";
export interface RankThresholds { pro: number; elite: number; veteran: number; legend: number }
/** The names a branch shows for its ranks: the owner's, or the standard ones. */
export type RankNames = Record<Rank, string>;
export interface IRankSettings {
  strategy: RankStrategy;
  thresholds: RankThresholds | null;
  /** The owner's own names (2026-11-25); absent from an older server = the standard ones. */
  names?: RankNames;
}

/** The owner's time bonus rule: in these hours, `per_window` seats with a limit win `minutes` free. */
export interface ITimeBonusSettings {
  enabled: boolean;
  /** "13:00", or null when never set. */
  from: string | null;
  to: string | null;
  minutes: number;
  per_window: number;
  /** The seats that may win (place ids); null = every seat. Absent from an older server. */
  place_ids?: number[] | null;
}

/** A seat that won free minutes and waits for a manager's answer. */
export interface ITimeBonusWin {
  id: number;
  branch_id: number;
  /** pending, or — answered by the player in the app — granted / declined / void (2026-11-25). Absent from an older server = pending. */
  status?: "pending" | "granted" | "declined" | "void";
  /** "player": the player answered in the app; the desk is told once. */
  answered_by?: "staff" | "player" | null;
  /** The player's phone was offered the win (a Club Card is on the seat). */
  asked_player?: boolean;
  session_id: number;
  minutes: number;
  drawn_at: string | null;
  place: { id: number; number: number | string | null; name: string | null } | null;
  /** The Club Card holder's name, when a card is on the seat. */
  player: string | null;
  ends_at: string | null;
}

export interface IBonusAccount {
  id: number;
  branch_id: number;
  name: string | null;
  phone: string;
  balance: string;
  opened_at: string | null;
  /** GAMER … LEGEND (2026-11-25); absent from an older server. */
  rank?: Rank;
  /** The owner froze the card's bonuses (2026-11-26): they cannot pay. Absent from an older server. */
  frozen?: boolean;
  /** The owner lowered the rank; the rule leaves it until given back (2026-11-26). */
  rank_held?: boolean;
  /** This club's 1–5 stars for the player (2026-11-26); null = not rated. */
  club_stars?: number | null;
  /** What every club thinks of the player (2026-11-26). */
  player_rating?: IRating;
  /** The club's latest words for the player (only at 1 star) (2026-11-27). */
  club_comment?: string | null;
  /** The player's latest stars, tags and words for this club (2026-11-27). */
  player_stars?: number | null;
  player_tags?: string[];
  player_comment?: string | null;
  /** Only in the «rate after a visit» list (`GET /bonus-rate-due`). */
  rank_name?: string;
  due_at?: string | null;
}

/** A rating as the server sends it (2026-11-26): the mean to one decimal, how many gave it; `average` null while nobody has. */
export interface IRating { average: string | null; count: number }

/** A rating after a visit (2026-11-27), or «Не сейчас». */
/** The club's rating of a visit (2026-11-27): stars, the reason at 1 star, bonuses as a gift; or «Не сейчас». */
export type RateVisit = { stars: number; comment: string | null; gift: string | null } | { skip: true };

export interface IBonusLookup {
  code: string;
  registered: boolean;
  account: IBonusAccount | null;
  /** What the player wrote in their app (2026-11-25), offered to staff. */
  player?: { name: string | null; phone: string | null };
  /**
   * This number's card held by an earlier copy of the app (2026-11-26): the
   * player removed it and added it again. Staff move it, never open a second.
   */
  existing?: IBonusAccount | null;
}

/** The 6-character code: the backend's ClubPlayerService::ALPHABET (no 0/O/1/I/L). */
export const BONUS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const BONUS_CODE_LENGTH = 6;

/** Case and spaces forgiven, as the server does; null when it cannot be a code. */
export const normaliseBonusCode = (raw: string): string | null => {
  const code = raw.replace(/\s+/g, "").toUpperCase();
  if (code.length !== BONUS_CODE_LENGTH) return null;
  for (const ch of code) if (!BONUS_CODE_ALPHABET.includes(ch)) return null;
  return code;
};

/**
 * What a scanned QR carries. The player's app encodes a link
 * `https://…/card/#c=ABC234` (or the bare code); either reads as the code.
 */
export const bonusCodeFromScan = (text: string): string | null => {
  const m = /[#?&]c=([A-Za-z0-9]{6})\b/.exec(text);
  return normaliseBonusCode(m ? m[1] : text.trim());
};
