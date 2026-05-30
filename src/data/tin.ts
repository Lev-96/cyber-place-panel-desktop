/**
 * Per-country TIN ("ИНН" / tax-identification number) validation for the
 * company-creation form.
 *
 * Kept in lock-step with the backend (`app/Services/Rules/TinValidatorRule.php`):
 * documented formats for the EU (VAT), the CIS region and the major economies,
 * with a sane generic fallback (5–20 alphanumerics) for the long tail. Keyed by
 * ISO alpha-2 code here (the picker stores a code); the backend keys the same
 * patterns by English country name.
 *
 * `validateTin` strips whitespace before matching; country-specific separators
 * (e.g. the US EIN hyphen) are allowed by their own pattern.
 */
interface TinRule {
  pattern: RegExp;
  /** Sample value shown in the field hint / error to guide the user. */
  example: string;
}

const RULES: Record<string, TinRule> = {
  // CIS / region
  AM: { pattern: /^\d{8}$/, example: "12345678" },
  GE: { pattern: /^(\d{9}|\d{11})$/, example: "123456789" },
  KZ: { pattern: /^\d{12}$/, example: "123456789012" },
  KG: { pattern: /^\d{14}$/, example: "12345678901234" },
  BY: { pattern: /^\d{9}$/, example: "123456789" },
  UA: { pattern: /^(\d{8}|\d{10})$/, example: "12345678" },
  UZ: { pattern: /^\d{9}$/, example: "123456789" },
  TM: { pattern: /^\d{9}$/, example: "123456789" },
  TJ: { pattern: /^\d{9}$/, example: "123456789" },
  MD: { pattern: /^\d{13}$/, example: "1234567890123" },

  // European Union (VAT)
  AT: { pattern: /^(AT)?U\d{8}$/i, example: "ATU12345678" },
  BE: { pattern: /^(BE)?[01]\d{9}$/i, example: "BE0123456789" },
  BG: { pattern: /^(BG)?\d{9,10}$/i, example: "123456789" },
  HR: { pattern: /^(HR)?\d{11}$/i, example: "12345678901" },
  CY: { pattern: /^(CY)?\d{8}[A-Z]$/i, example: "12345678X" },
  CZ: { pattern: /^(CZ)?\d{8,10}$/i, example: "12345678" },
  DK: { pattern: /^(DK)?\d{8}$/i, example: "12345678" },
  EE: { pattern: /^(EE)?\d{9}$/i, example: "123456789" },
  FI: { pattern: /^(FI)?\d{8}$/i, example: "12345678" },
  FR: { pattern: /^(FR)?[A-Z0-9]{2}\d{9}$/i, example: "FR12345678901" },
  DE: { pattern: /^(DE)?\d{9}$/i, example: "DE123456789" },
  GR: { pattern: /^(EL|GR)?\d{9}$/i, example: "EL123456789" },
  HU: { pattern: /^(HU)?\d{8}$/i, example: "12345678" },
  IE: { pattern: /^(IE)?\d{7}[A-W][A-IW]?$/i, example: "1234567T" },
  IT: { pattern: /^(IT)?\d{11}$/i, example: "12345678901" },
  LV: { pattern: /^(LV)?\d{11}$/i, example: "12345678901" },
  LT: { pattern: /^(LT)?(\d{9}|\d{12})$/i, example: "123456789" },
  LU: { pattern: /^(LU)?\d{8}$/i, example: "12345678" },
  MT: { pattern: /^(MT)?\d{8}$/i, example: "12345678" },
  NL: { pattern: /^(NL)?\d{9}B\d{2}$/i, example: "NL123456789B01" },
  PL: { pattern: /^(PL)?\d{10}$/i, example: "1234567890" },
  PT: { pattern: /^(PT)?\d{9}$/i, example: "123456789" },
  RO: { pattern: /^(RO)?\d{2,10}$/i, example: "RO1234567" },
  SK: { pattern: /^(SK)?\d{10}$/i, example: "1234567890" },
  SI: { pattern: /^(SI)?\d{8}$/i, example: "12345678" },
  ES: { pattern: /^(ES)?[A-Z0-9]\d{7}[A-Z0-9]$/i, example: "A1234567Z" },
  SE: { pattern: /^(SE)?\d{12}$/i, example: "123456789012" },

  // Other Europe / majors
  AL: { pattern: /^[A-Z]\d{8}[A-Z]$/i, example: "J12345678N" },
  RS: { pattern: /^\d{9}$/, example: "123456789" },
  NO: { pattern: /^(NO)?\d{9}$/i, example: "123456789" },
  CH: { pattern: /^(CHE)?-?\d{3}\.?\d{3}\.?\d{3}$/i, example: "CHE-123.456.789" },
  GB: { pattern: /^(GB)?(\d{9}|\d{12})$/i, example: "123456789" },
  US: { pattern: /^\d{2}-?\d{7}$/, example: "12-3456789" },

  // Asia / Pacific
  CN: { pattern: /^[A-Z0-9]{18}$/i, example: "91110000XXXXXXXX1X" },
  IN: { pattern: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i, example: "27ABCDE1234F1Z5" },
  JP: { pattern: /^\d{13}$/, example: "1234567890123" },
  KR: { pattern: /^\d{10}$/, example: "1234567890" },
  AU: { pattern: /^\d{11}$/, example: "12345678901" },
  NZ: { pattern: /^\d{8,9}$/, example: "123456789" },

  // Americas / MEA
  CA: { pattern: /^\d{9}$/, example: "123456789" },
  BR: { pattern: /^\d{14}$/, example: "12345678000199" },
  MX: { pattern: /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/i, example: "ABC123456XYZ" },
  AR: { pattern: /^\d{11}$/, example: "20123456789" },
  ZA: { pattern: /^\d{10}$/, example: "1234567890" },
  AE: { pattern: /^\d{15}$/, example: "123456789012345" },
  SA: { pattern: /^\d{15}$/, example: "123456789012345" },
  IL: { pattern: /^\d{9}$/, example: "123456789" },
  EG: { pattern: /^\d{9}$/, example: "123456789" },
};

const GENERIC: TinRule = { pattern: /^[A-Za-z0-9]{5,20}$/, example: "" };

const normalize = (value: string): string => value.replace(/\s+/g, "").trim();

/** Compiled rules fetched from the backend, keyed by ISO code. */
export type TinRuleMap = Record<string, TinRule>;

/**
 * Compile the backend's `/tin-rules` payload into usable RegExps. Bad
 * patterns are skipped so one malformed row can't break the whole map; the
 * static rules below still cover those codes as a fallback.
 */
export const buildTinMap = (
  rules: { country_code: string; pattern: string; flags: string; example?: string | null }[],
): TinRuleMap => {
  const map: TinRuleMap = {};
  for (const r of rules) {
    try {
      map[r.country_code.toUpperCase()] = {
        pattern: new RegExp(r.pattern, r.flags || undefined),
        example: r.example ?? "",
      };
    } catch {
      /* skip a malformed stored pattern — static fallback covers it */
    }
  }
  return map;
};

/** Pick the rule for a code: fetched (DB) map first, then static, then generic. */
const ruleFor = (countryCode: string | null | undefined, override?: TinRuleMap): TinRule => {
  const code = countryCode?.toUpperCase();
  return (
    (code && override?.[code]) ||
    (code && RULES[code]) ||
    GENERIC
  );
};

/**
 * Validate a TIN against the selected country's format.
 * Returns whether it's valid plus the country's example (for hints/errors).
 * An empty / unmapped country falls back to the generic rule.
 */
export const validateTin = (
  countryCode: string | null | undefined,
  value: string,
  override?: TinRuleMap,
): { valid: boolean; example: string } => {
  const rule = ruleFor(countryCode, override);
  const v = normalize(value);
  return { valid: rule.pattern.test(v), example: rule.example };
};

/** True when we ship a country-specific rule (vs the generic fallback). */
export const hasStrictTinRule = (countryCode: string | null | undefined, override?: TinRuleMap): boolean =>
  !!(countryCode && ((override && override[countryCode.toUpperCase()]) || RULES[countryCode.toUpperCase()]));

export const tinExample = (countryCode: string | null | undefined, override?: TinRuleMap): string =>
  ruleFor(countryCode, override).example;
