/**
 * Per-country TIN ("ИНН" / tax-identification number) validation for the
 * company-creation form.
 *
 * Tax-ID formats are country-specific. We keep STRICT rules for the
 * countries this product actually onboards (Armenia + the CIS region) and
 * the common majors, and fall back to a permissive-but-sane generic check
 * (5–20 alphanumerics) for the long tail — better than no validation, and
 * easy to tighten per country on request.
 *
 * `validateTin` normalises away spaces before matching; country-specific
 * separators (e.g. the US EIN hyphen) are allowed by their own pattern.
 */
interface TinRule {
  pattern: RegExp;
  /** Sample value shown in the field hint / error to guide the user. */
  example: string;
}

const RULES: Record<string, TinRule> = {
  // ── Region this product onboards ──
  AM: { pattern: /^\d{8}$/, example: "12345678" },               // Armenia — TIN/ՀՎՀՀ, 8 digits
  GE: { pattern: /^(\d{9}|\d{11})$/, example: "123456789" },      // Georgia — 9 (entity) / 11 (personal)
  KZ: { pattern: /^\d{12}$/, example: "123456789012" },           // Kazakhstan — BIN/IIN, 12 digits
  KG: { pattern: /^\d{14}$/, example: "12345678901234" },         // Kyrgyzstan — INN, 14 digits
  BY: { pattern: /^\d{9}$/, example: "123456789" },               // Belarus — UNP, 9 digits
  UA: { pattern: /^(\d{8}|\d{10})$/, example: "12345678" },       // Ukraine — EDRPOU 8 / personal 10
  UZ: { pattern: /^\d{9}$/, example: "123456789" },               // Uzbekistan — INN, 9 digits
  TM: { pattern: /^\d{9}$/, example: "123456789" },               // Turkmenistan — 9 digits
  TJ: { pattern: /^\d{9}$/, example: "123456789" },               // Tajikistan — INN, 9 digits
  MD: { pattern: /^\d{13}$/, example: "1234567890123" },          // Moldova — IDNO, 13 digits

  // ── Common majors ──
  US: { pattern: /^\d{2}-?\d{7}$/, example: "12-3456789" },       // USA — EIN
  GB: { pattern: /^(\d{9}|\d{12})$/, example: "123456789" },      // UK — VAT 9/12
  DE: { pattern: /^(DE)?\d{9}$/i, example: "DE123456789" },       // Germany — USt-IdNr
  FR: { pattern: /^(FR)?[A-Z0-9]{0,2}\d{9}$/i, example: "FR12345678901" }, // France — SIREN/VAT
  IT: { pattern: /^\d{11}$/, example: "12345678901" },            // Italy — Partita IVA
  ES: { pattern: /^[A-Z0-9]\d{7}[A-Z0-9]$/i, example: "A1234567Z" }, // Spain — NIF/CIF
  PL: { pattern: /^\d{10}$/, example: "1234567890" },             // Poland — NIP
  NL: { pattern: /^(NL)?\d{9}B\d{2}$/i, example: "NL123456789B01" }, // Netherlands — BTW
  CZ: { pattern: /^\d{8,10}$/, example: "12345678" },             // Czechia — DIČ
  SK: { pattern: /^\d{10}$/, example: "1234567890" },             // Slovakia — IČ DPH
  RO: { pattern: /^(RO)?\d{2,10}$/i, example: "RO1234567" },      // Romania — CUI
  BG: { pattern: /^\d{9,10}$/, example: "123456789" },            // Bulgaria — EIK/BULSTAT
  GR: { pattern: /^(EL)?\d{9}$/i, example: "EL123456789" },       // Greece — AFM
  PT: { pattern: /^(PT)?\d{9}$/i, example: "123456789" },         // Portugal — NIF
  IE: { pattern: /^\d{7}[A-W][A-IW]?$/i, example: "1234567T" },   // Ireland — VAT
  AT: { pattern: /^(AT)?U\d{8}$/i, example: "ATU12345678" },      // Austria — UID
  BE: { pattern: /^(BE)?0?\d{9}$/i, example: "BE0123456789" },    // Belgium — VAT
  CH: { pattern: /^(CHE)?-?\d{3}\.?\d{3}\.?\d{3}$/i, example: "CHE-123.456.789" }, // Switzerland — UID
  IN: { pattern: /^\d{10}[A-Z]{1}\d{1}[A-Z]\d[A-Z\d]$/i, example: "27ABCDE1234F1Z5" }, // India — GSTIN
  CN: { pattern: /^[A-Z0-9]{18}$/i, example: "91110000XXXXXXXX1X" }, // China — USCC, 18 chars
};

const GENERIC: TinRule = { pattern: /^[A-Za-z0-9]{5,20}$/, example: "" };

const normalize = (value: string): string => value.replace(/\s+/g, "").trim();

/**
 * Validate a TIN against the selected country's format.
 * Returns whether it's valid plus the country's example (for hints/errors).
 * An empty country falls back to the generic rule.
 */
export const validateTin = (
  countryCode: string | null | undefined,
  value: string,
): { valid: boolean; example: string } => {
  const rule = (countryCode && RULES[countryCode.toUpperCase()]) || GENERIC;
  const v = normalize(value);
  return { valid: rule.pattern.test(v), example: rule.example };
};

/** True when we ship a country-specific rule (vs the generic fallback). */
export const hasStrictTinRule = (countryCode: string | null | undefined): boolean =>
  !!(countryCode && RULES[countryCode.toUpperCase()]);

export const tinExample = (countryCode: string | null | undefined): string =>
  ((countryCode && RULES[countryCode.toUpperCase()]) || GENERIC).example;
