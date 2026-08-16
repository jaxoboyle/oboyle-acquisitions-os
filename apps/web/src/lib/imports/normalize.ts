// Normalization helpers used for BOTH column-value cleanup and duplicate
// detection. Kept pure/dependency-free so they're trivially unit-testable
// without a database or network connection.

const STREET_SUFFIXES: Record<string, string> = {
  street: "st", st: "st",
  avenue: "ave", ave: "ave",
  boulevard: "blvd", blvd: "blvd",
  drive: "dr", dr: "dr",
  lane: "ln", ln: "ln",
  road: "rd", rd: "rd",
  court: "ct", ct: "ct",
  circle: "cir", cir: "cir",
  place: "pl", pl: "pl",
  terrace: "ter", ter: "ter",
  parkway: "pkwy", pkwy: "pkwy",
  highway: "hwy", hwy: "hwy",
  trail: "trl", trl: "trl",
  square: "sq", sq: "sq",
  way: "way",
};

const DIRECTIONALS: Record<string, string> = {
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};

/** Uppercase-insensitive, punctuation-insensitive address key for duplicate matching.
 * "123 Main St." and "123 MAIN STREET" both normalize to "123 main st". */
export function normalizeAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  const tokens = raw
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\bapt\b|\bunit\b|\bsuite\b|\bste\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  return tokens
    .map((t) => STREET_SUFFIXES[t] ?? DIRECTIONALS[t] ?? t)
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Loose name key for duplicate matching — case/whitespace/punctuation-insensitive. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits-only phone key ("(555) 123-4567" -> "5551234567"). Drops a leading
 * US country code so "15551234567" and "5551234567" match. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/** Parcel/APN key — alphanumeric only, uppercased. Formatting like dashes
 * and spaces varies wildly by county assessor, the identifier doesn't. */
export function normalizeParcel(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Best-effort currency/number parse — strips "$", commas, "k" suffix, whitespace. */
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const kSuffix = /k$/i.test(trimmed);
  const cleaned = trimmed.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return kSuffix ? n * 1000 : n;
}

export function cleanString(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : null;
}
