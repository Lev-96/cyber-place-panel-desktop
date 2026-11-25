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
  /** The time bonus (2026-11-25); absent from a server before it. */
  time_bonus?: ITimeBonusSettings;
}

/** The owner's time bonus rule: in these hours, `per_window` seats with a limit win `minutes` free. */
export interface ITimeBonusSettings {
  enabled: boolean;
  /** "13:00", or null when never set. */
  from: string | null;
  to: string | null;
  minutes: number;
  per_window: number;
}

/** A seat that won free minutes and waits for a manager's answer. */
export interface ITimeBonusWin {
  id: number;
  branch_id: number;
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
}

export interface IBonusLookup {
  code: string;
  registered: boolean;
  account: IBonusAccount | null;
  /** What the player wrote in their app (2026-11-25), offered to staff. */
  player?: { name: string | null; phone: string | null };
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
