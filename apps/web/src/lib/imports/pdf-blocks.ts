// Splits extracted PDF prose into one block of text per property
// opportunity, then pulls fields out of each block by LABEL, not by line.
//
// Why label-based and not line-based: PDF text extraction routinely
// produces both "one field spans several lines" (a wrapped owner name) and
// "several labels share one line" (a compact report packs "Owner-Direct?
// OWNER DIRECT Occupancy NV" onto a single line). A line-oriented parser
// gets both wrong. Treating each block as one continuous string and finding
// every known label's position handles both: a value is "everything after
// this label's match, up to the next label's match" — regardless of how
// many original newlines or other labels happen to fall in between.

export type PdfBlockFields = Partial<Record<
  | "seller_name" | "address" | "mailing_address" | "city" | "county" | "state" | "zip"
  | "phone" | "email" | "parcel_number" | "asking_price" | "estimated_value" | "arv"
  | "motivation_score" | "owner_direct" | "occupancy" | "foreclosure" | "foreclosure_date"
  | "tax_delinquency" | "probate" | "vacancy" | "repair_level" | "strategy" | "motivation"
  | "first_outreach" | "source" | "notes",
  string
>>;

type LabelField = keyof PdfBlockFields;

// Longer/more specific patterns must precede shorter ones that are their
// prefix (e.g. "property address" before "address") so the master regex's
// leftmost-longest alternation picks the specific one.
const LABELS: Array<{ field: LabelField; patterns: string[] }> = [
  { field: "mailing_address", patterns: ["mailing address"] },
  { field: "address", patterns: ["property address", "site address", "situs address", "address"] },
  { field: "seller_name", patterns: ["owner name", "seller name", "property owner", "owner", "seller"] },
  { field: "city", patterns: ["city"] },
  { field: "county", patterns: ["county"] },
  { field: "state", patterns: ["state"] },
  { field: "zip", patterns: ["zip code", "zip"] },
  { field: "phone", patterns: ["phone / email", "phone/email", "phone number", "phone", "cell"] },
  { field: "email", patterns: ["email"] },
  // Bare "parcel" is deliberately NOT a trigger here — it's an ordinary
  // English word that shows up mid-sentence ("Notes: Parcel 3422-585-...")
  // far more often than as its own field label in this report family.
  // extractParcelFromText() below pulls the number out of Notes/foreclosure
  // text directly instead; only the unambiguous, specific phrasings (and
  // the acronym "APN", unlikely to appear as prose) are trusted as a real
  // field-label boundary.
  { field: "parcel_number", patterns: ["parcel / apn", "parcel number", "parcel id", "apn"] },
  { field: "asking_price", patterns: ["asking price"] },
  { field: "estimated_value", patterns: ["price / est.", "price/est.", "price / est", "est. value", "estimated value", "est value"] },
  { field: "arv", patterns: ["est. arv", "estimated arv", "arv"] },
  { field: "motivation_score", patterns: ["motivation score"] },
  { field: "owner_direct", patterns: ["owner-direct?", "owner direct?", "owner-direct", "owner direct"] },
  { field: "occupancy", patterns: ["occupancy"] },
  { field: "foreclosure_date", patterns: ["foreclosure/auction date", "foreclosure / auction date", "auction date"] },
  { field: "foreclosure", patterns: ["foreclosure / lis pendens", "foreclosure/lis pendens", "lis pendens", "foreclosure"] },
  { field: "tax_delinquency", patterns: ["tax delinquency", "tax delinquent"] },
  { field: "probate", patterns: ["probate / estate", "probate/estate", "probate"] },
  { field: "vacancy", patterns: ["vacancy"] },
  { field: "repair_level", patterns: ["repair level"] },
  { field: "strategy", patterns: ["strategy"] },
  { field: "motivation", patterns: ["motivation"] },
  { field: "first_outreach", patterns: ["first outreach suggestion", "first outreach"] },
  { field: "source", patterns: ["source"] },
  { field: "notes", patterns: ["notes"] },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALL_PATTERNS = LABELS.flatMap((l) => l.patterns.map((p) => ({ field: l.field, pattern: p })))
  .sort((a, b) => b.pattern.length - a.pattern.length);

const PATTERN_TO_FIELD = new Map(ALL_PATTERNS.map((p) => [p.pattern, p.field]));
// `\b` only guards the START of the match — patterns ending in punctuation
// ("owner-direct?") can't also end in a plain `\b` (a boundary needs one
// side to be a word char and the other not; "?" then a space are BOTH
// non-word, so a trailing `\b` there would never fire and silently break
// every punctuation-ending label). A trailing `(?!\w)` lookahead instead:
// succeeds whenever the next character isn't a word character, regardless
// of what the pattern itself ends in — which is what actually stops
// "owner" from matching inside "owner3@example.com" while still matching
// "owner-direct?" followed by a space.
const MASTER_LABEL_RE = new RegExp(
  `\\b(${ALL_PATTERNS.map((p) => escapeRegex(p.pattern)).join("|")})(?!\\w)\\s*[:?]?\\s*[-—]?\\s*`,
  "gi"
);

// "Weak" labels are ordinary English words that legitimately show up
// INSIDE free-text values too — "notes" inside a notes sentence, "owner"
// inside an owner-direct status echo ("Owner-Direct? OWNER DIRECT"),
// "source" inside a sentence about where a lead came from. A bare
// occurrence deep in a paragraph is almost always prose, not a new field —
// only trust one as a real boundary when it sits right next to another
// already-recognized label (that's what "multiple labels share one line"
// actually looks like structurally: short, back-to-back, not separated by
// a run of ordinary sentence text). "Strong" labels (address/phone/email/
// parcel/price-shaped things) rarely occur as incidental prose, so those
// are always trusted.
const WEAK_FIELDS = new Set<LabelField>([
  "seller_name", "city", "county", "state", "zip", "occupancy", "foreclosure",
  "tax_delinquency", "probate", "vacancy", "strategy", "motivation",
  "first_outreach", "source", "notes",
]);
// Tight-adjacency fallback for weak labels that share one physical source
// line ("Owner-Direct? OWNER DIRECT Occupancy NV") — kept small on purpose.
// The real, more reliable signal is startsFreshLine (below): a label that
// begins its own original source line is almost always a genuine field,
// regardless of how long the previous field's value ran.
const ADJACENT_GAP_CHARS = 12;

// Florida county parcel IDs vary by county: hyphen-grouped ("13-38-40-006-
// 000-47030-8"), continuous with a trailing decimal ("33401900004064000103.0"),
// or dash-grouped-with-no-decimal — the shared shape is just "digits, with
// occasional - or . separators, 8+ digits total."
const RE_PARCEL_IN_TEXT = /parcel\s*(?:number|id|#|no\.?)?[:\s]+(\d[\d.-]{6,28}\d)/i;
const RE_NEGATORY_EXACT = /^(n\/?a|nf|none|unknown|-{1,3}|tbd)$/i;
const RE_NEGATORY_PHRASE = /\b(not shown|not found|not available|unavailable|not provided)\b/i;

function cleanValue(v: string): string | null {
  const trimmed = v.replace(/^[-—:\s]+|[-—:\s]+$/g, "").trim();
  if (!trimmed) return null;
  if (RE_NEGATORY_EXACT.test(trimmed)) return null;
  if (trimmed.length < 40 && RE_NEGATORY_PHRASE.test(trimmed)) return null;
  return trimmed;
}

/** Flattens multiline text to one line (so a value can span original line
 * breaks) while remembering every position where a NEW source line began —
 * that position set is what lets the label matcher tell "Tax Delinquency"
 * starting its own fresh line (a real field, however long the previous
 * field's value ran) apart from "owner" turning up mid-sentence deep in a
 * paragraph (not a field, just a word). */
function flattenPreservingLineStarts(text: string): { flat: string; lineStarts: Set<number> } {
  const lineStarts = new Set<number>();
  let flat = "";
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      let hadNewline = false;
      let j = i;
      while (j < text.length && /\s/.test(text[j])) {
        if (text[j] === "\n") hadNewline = true;
        j++;
      }
      if (flat.length > 0 && j < text.length) flat += " ";
      if (hadNewline) lineStarts.add(flat.length);
      i = j;
    } else {
      flat += text[i];
      i++;
    }
  }
  return { flat, lineStarts };
}

function isNearLineStart(index: number, lineStarts: Set<number>): boolean {
  for (let d = -1; d <= 1; d++) if (lineStarts.has(index + d)) return true;
  return false;
}

/** Extracts every known label's value from one block of continuous text.
 * Multiline values (label...\n...\ncontinued) and multiple labels sharing
 * one physical line both fall out of the same mechanism: a value is
 * whatever sits between this label match and the next one, with internal
 * newlines flattened to spaces first. */
export function extractLabeledFields(blockText: string): { fields: PdfBlockFields; leadIn: string } {
  const { flat: flatRaw, lineStarts } = flattenPreservingLineStarts(blockText);
  const flat = flatRaw.trim();
  const trimOffset = flatRaw.length - flatRaw.trimStart().length;

  const isAllCapsWord = (s: string) => s === s.toUpperCase() && s !== s.toLowerCase();

  const rawMatches = [...flat.matchAll(MASTER_LABEL_RE)]
    .map((m) => {
      const matchedText = m[1].toLowerCase();
      const field = PATTERN_TO_FIELD.get(matchedText) ?? findFieldFuzzy(matchedText);
      return field ? { index: m.index!, end: m.index! + m[0].length, field, raw: m[1] } : null;
    })
    .filter((m): m is { index: number; end: number; field: LabelField; raw: string } => m !== null)
    // This report's real field labels are consistently Title Case
    // ("Owner", "Property Address"); ALL-CAPS occurrences of the same word
    // are status-value text echoing the label ("Owner-Direct? OWNER
    // DIRECT"), not a second real label — drop those before the adjacency
    // pass even gets a chance to (wrongly) accept them as "packed" labels.
    .filter((m) => !isAllCapsWord(m.raw))
    // A label glued directly onto a preceding hyphen is virtually always
    // the tail of a compound word ("non-owner-occupied", "co-owner"), never
    // a genuine field boundary — this report's real labels are never
    // hyphen-prefixed.
    .filter((m) => flat[m.index - 1] !== "-");

  // Drop weak-label matches that aren't either (a) tightly packed right
  // after a prior accepted label on the same source line, or (b) starting
  // a fresh source line of their own — those are the two shapes a genuine
  // field label actually takes in this report family. Anything else is a
  // word that happens to appear mid-sentence inside another field's value.
  const matches: typeof rawMatches = [];
  for (const m of rawMatches) {
    if (!WEAK_FIELDS.has(m.field)) {
      matches.push(m);
      continue;
    }
    const prev = matches[matches.length - 1];
    const isAdjacentToPrior = prev != null && m.index - prev.end <= ADJACENT_GAP_CHARS;
    const startsFreshLine = isNearLineStart(m.index + trimOffset, lineStarts);
    if (isAdjacentToPrior || startsFreshLine) matches.push(m);
  }

  const fields: PdfBlockFields = {};
  if (matches.length === 0) {
    return { fields, leadIn: flat };
  }

  const leadIn = flat.slice(0, matches[0].index).trim();

  for (let i = 0; i < matches.length; i++) {
    const { end, field } = matches[i];
    const stop = i + 1 < matches.length ? matches[i + 1].index : flat.length;
    const value = cleanValue(flat.slice(end, stop));
    if (!value) continue;

    fields[field] = fields[field] ? `${fields[field]}; ${value}` : value;
  }

  return { fields, leadIn };
}

function findFieldFuzzy(matchedLower: string): LabelField | undefined {
  const hit = ALL_PATTERNS.find((p) => p.pattern === matchedLower);
  return hit?.field;
}

// ── Mode 2 — numbered property report ("#1 ... #2 ... #28") ───────────────
const RECORD_MARKER_RE = /(?:^|\n)\s*#\s*(\d{1,4})\b/g;

export function detectNumberedBlocks(text: string): Array<{ number: number; text: string }> | null {
  const matches = [...text.matchAll(RECORD_MARKER_RE)];
  if (matches.length < 2) return null;

  const numbers = matches.map((m) => parseInt(m[1], 10));

  // Sanity gate (the actual fix for the 204-vs-28 bug): a real numbered
  // report's markers form a tight, mostly-sequential run starting near 1.
  // Reject anything that doesn't look like that instead of trusting every
  // "#123" that happens to appear in body text (e.g. inside a price or an
  // ID string) as a record boundary.
  const maxNum = Math.max(...numbers);
  const minNum = Math.min(...numbers);
  if (minNum > 3) return null; // doesn't start near record #1
  if (maxNum > matches.length * 1.5 + 5) return null; // too sparse a sequence
  const uniqueRatio = new Set(numbers).size / numbers.length;
  if (uniqueRatio < 0.8) return null; // too many repeats of the same number

  const blocks: Array<{ number: number; text: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    blocks.push({ number: numbers[i], text: text.slice(start, end).trim() });
  }
  return blocks;
}

// ── Mode 3 — repeating labeled records, no record numbers ─────────────────
// Same label vocabulary, but the block boundary is "wherever the primary
// identity label (Owner/Seller/Property Address) recurs" instead of a
// number. Requires at least 3 repeats at roughly even spacing to trust it —
// a single "Owner" mention near the top of an otherwise free-text document
// should NOT be treated as 1-of-N records.
const PRIMARY_LABEL_RE = /\b(property address|owner name|seller name|owner|seller)(?!\w)\s*[:?]?\s*[-—]?\s*/gi;

export function detectRepeatingLabelBlocks(text: string): string[] | null {
  const matches = [...text.matchAll(PRIMARY_LABEL_RE)];
  if (matches.length < 3) return null;

  const gaps: number[] = [];
  for (let i = 1; i < matches.length; i++) gaps.push(matches[i].index! - matches[i - 1].index!);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  // Too irregular (a huge outlier gap) suggests these aren't actually
  // record-start markers, just incidental mentions of "Owner" in prose.
  const wildGaps = gaps.filter((g) => g > avgGap * 4 || g < avgGap * 0.15).length;
  if (wildGaps > gaps.length * 0.4) return null;

  const blocks: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    blocks.push(text.slice(start, end).trim());
  }
  return blocks;
}

export function extractParcelFromText(text: string): string | null {
  const m = text.match(RE_PARCEL_IN_TEXT);
  return m ? m[1] : null;
}

// Grid-style addressing ("1550 Avenue Q") has no street-name word at all —
// the suffix sits directly after the house number — so it needs its own
// alternative rather than forcing it through the general pattern below.
const RE_STREET_GRID = /^(\d+\s+(?:Avenue|Ave|Street|St)\s+[A-Z])\b/i;
const RE_STREET_PREFIX = /^(\d+\s+(?:[NSEW]{1,2}\s+)?[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,3}?\s+(?:Cir(?:cle)?|Ave(?:nue)?|Rd|Dr(?:ive)?|Ln|Way|Blvd|Ct|Pl(?:ace)?|Pkwy|Ter(?:race)?|St(?:reet)?|Trl|Sq|Cove|Run|Loop))\b/i;
const RE_COUNTY_ZIP = /·?\s*([A-Za-z.\s]{2,30}?)\s*County\s*·?\s*(\d{5})?/i;
const RE_SCORE = /\b(\d{1,2})\s*\/\s*10\b/;

/** Parses the "heading" text before a block's first recognized label —
 * this report family (and others like it) puts the street address, city,
 * county, ZIP, and a motivation score there as one compact unlabeled line
 * ("1247 NW Leonardo Cir Port St. Lucie · St. Lucie County · 34986 9/10")
 * rather than under individual field labels. Best-effort: whatever it
 * can't confidently split out stays in the heading text that the caller
 * folds into Notes, so nothing is lost either way. */
export function parseLeadIn(leadIn: string): {
  address: string | null; city: string | null; county: string | null; zip: string | null; motivationScore: string | null;
} {
  if (!leadIn) return { address: null, city: null, county: null, zip: null, motivationScore: null };

  const scoreMatch = leadIn.match(RE_SCORE);
  const countyMatch = leadIn.match(RE_COUNTY_ZIP);
  const streetMatch = leadIn.match(RE_STREET_GRID) ?? leadIn.match(RE_STREET_PREFIX);

  let city: string | null = null;
  if (streetMatch) {
    // Whatever sits between the end of the street address and the county
    // marker (or score, or end of string) is the city.
    const afterStreet = leadIn.slice(streetMatch[0].length);
    const cityText = afterStreet.split(/·/)[0].replace(RE_SCORE, "").trim();
    city = cleanValue(cityText.replace(/\s+/g, " "));
  }

  return {
    address: streetMatch ? streetMatch[1].trim() : null,
    city,
    county: countyMatch ? cleanValue(countyMatch[1].replace(/\s+/g, " ")) : null,
    zip: countyMatch?.[2] ?? (leadIn.match(/\b(\d{5})\b/)?.[1] ?? null),
    motivationScore: scoreMatch ? `${scoreMatch[1]}/10` : null,
  };
}

/** Converts one block's extracted label fields into the canonical header
 * vocabulary column-map.ts already recognizes ("Owner", "Property Address",
 * "APN", ...), so Mode 2/3 output flows through the exact same
 * mapColumns → normalizeRow → dedupe → insert pipeline as CSV/XLSX rows —
 * no separate import path to keep in sync. Anything without a dedicated
 * leads column (foreclosure detail, tax delinquency, probate, vacancy,
 * strategy, motivation score, first-outreach suggestion, estimated value)
 * is preserved as a clearly labeled line in Notes rather than dropped. */
export function blockToRow(recordNumber: number | null, fields: PdfBlockFields, leadIn: string): Record<string, string> {
  const row: Record<string, string> = {};
  const fromHeading = parseLeadIn(leadIn);

  if (fields.seller_name) row["Owner"] = fields.seller_name;
  if (fields.address || fromHeading.address) row["Property Address"] = fields.address ?? fromHeading.address!;
  if (fields.mailing_address) row["Mailing Address"] = fields.mailing_address;
  if (fields.city || fromHeading.city) row["City"] = fields.city ?? fromHeading.city!;
  if (fields.county || fromHeading.county) row["County"] = fields.county ?? fromHeading.county!;
  if (fields.state) row["State"] = fields.state;
  if (fields.zip || fromHeading.zip) row["Zip"] = fields.zip ?? fromHeading.zip!;
  if (fields.parcel_number) row["APN"] = fields.parcel_number;
  if (fields.asking_price) row["Asking Price"] = fields.asking_price;
  if (fields.arv) row["ARV"] = fields.arv;
  if (fields.occupancy) row["Occupancy"] = fields.occupancy;
  if (fields.repair_level) row["Repair Level"] = fields.repair_level;

  // Phone/email: a combined "Phone / Email" label's value may itself
  // contain both, or a negatory ("NOT FOUND") that already got filtered
  // out by cleanValue — split whatever text remains.
  const phoneEmailBlob = [fields.phone, fields.email].filter(Boolean).join(" ");
  const phoneMatch = phoneEmailBlob.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  const emailMatch = phoneEmailBlob.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (phoneMatch) row["Phone"] = phoneMatch[0];
  if (emailMatch) row["Email"] = emailMatch[0];

  if (fields.motivation) row["Motivation"] = fields.motivation;

  // Lead source: owner-direct status is genuinely "where this came from."
  const sourceParts = [fields.owner_direct, fields.source].filter(Boolean);
  if (sourceParts.length) row["Source"] = sourceParts.join(" — ");

  // Everything without a dedicated column stays visible, clearly labeled.
  const noteLines: string[] = [];
  if (recordNumber != null) noteLines.push(`Report record #${recordNumber}`);
  if (leadIn && leadIn.length > 2) noteLines.push(`Heading: ${leadIn}`);
  if (fields.estimated_value) noteLines.push(`Estimated value: ${fields.estimated_value}`);
  const motivationScore = fields.motivation_score ?? fromHeading.motivationScore;
  if (motivationScore) noteLines.push(`Motivation score: ${motivationScore}`);
  if (fields.foreclosure) noteLines.push(`Foreclosure / Lis Pendens: ${fields.foreclosure}`);
  if (fields.foreclosure_date) noteLines.push(`Foreclosure/auction date: ${fields.foreclosure_date}`);
  if (fields.tax_delinquency) noteLines.push(`Tax delinquency: ${fields.tax_delinquency}`);
  if (fields.probate) noteLines.push(`Probate/estate: ${fields.probate}`);
  if (fields.vacancy) noteLines.push(`Vacancy: ${fields.vacancy}`);
  if (fields.strategy) noteLines.push(`Strategy: ${fields.strategy}`);
  if (fields.first_outreach) noteLines.push(`First outreach: ${fields.first_outreach}`);
  if (fields.notes) noteLines.push(fields.notes);

  // Parcel numbers often live inside a free-text sentence rather than their
  // own labeled field ("Notes: Parcel 3422-585-0091-000-7.") — and not
  // reliably inside Notes specifically, since a missed adjacent-label match
  // can let that sentence spill into whichever weak field was still open
  // (Source, Strategy, ...). Scan every captured field's text rather than
  // guessing which one, and pull the number out for the structured APN
  // column while leaving the original sentence wherever it landed intact.
  if (!row["APN"]) {
    const fromAnyField = extractParcelFromText(Object.values(fields).join(" "));
    if (fromAnyField) row["APN"] = fromAnyField;
  }

  if (noteLines.length) row["Notes"] = noteLines.join("\n");

  return row;
}
