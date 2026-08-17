// Server-only file parsing for Big Stein seller-list imports. Never import
// this from a client component — exceljs/unpdf are large Node libraries
// that have no business in the browser bundle; they're only ever touched
// from the /api/chat/upload route handler.
//
// Uses exceljs rather than the more common `xlsx` (SheetJS) package: the
// npm-published `xlsx` build is stuck on 0.18.5 with unpatched high-severity
// prototype-pollution and ReDoS advisories (SheetJS only ships fixed builds
// through their own CDN now), which is not acceptable for a route that
// parses files uploaded by a user.
//
// Uses unpdf (a maintained pdfjs-dist wrapper built for serverless/edge
// runtimes) rather than `pdf-parse`: pdf-parse hasn't been updated since
// ~2021 and bundles a frozen old pdf.js — verified directly (not assumed)
// that it throws "bad XRef entry" on a spec-compliant, byte-accurate xref
// table, i.e. it can fail on genuinely valid PDFs. unpdf reads the same
// file correctly and additionally exposes real per-glyph position data,
// which is what makes real column detection (Stage B below) possible at
// all instead of guessing from whitespace in already-space-collapsed text.
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { getDocumentProxy, extractText } from "unpdf";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
};

export type SupportedFileType = "csv" | "xlsx" | "pdf" | "txt";

const MAX_ROWS = 5000;

export function detectFileType(filename: string, mimeType: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv" || mimeType === "text/csv") return "csv";
  if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet") || mimeType.includes("ms-excel")) return "xlsx";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "txt" || mimeType === "text/plain") return "txt";
  return null;
}

export async function parseFile(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<ParsedFile> {
  switch (fileType) {
    case "csv":
      return parseDelimitedText(buffer.toString("utf-8"));
    case "txt":
      return parseDelimitedText(buffer.toString("utf-8"));
    case "xlsx":
      return parseXlsx(buffer);
    case "pdf":
      return parsePdf(buffer);
  }
}

function parseDelimitedText(text: string): ParsedFile {
  const warnings: string[] = [];
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  let headers = result.meta.fields ?? [];
  let rows = result.data;

  // A .txt file with no real delimiter parses as a single "column" — try
  // tab and pipe explicitly before giving up.
  if (headers.length <= 1) {
    for (const delimiter of ["\t", "|"]) {
      const retry = Papa.parse<Record<string, string>>(text.trim(), {
        header: true,
        skipEmptyLines: true,
        delimiter,
      });
      if ((retry.meta.fields?.length ?? 0) > 1) {
        headers = retry.meta.fields ?? [];
        rows = retry.data;
        break;
      }
    }
  }

  if (headers.length <= 1) {
    warnings.push(
      "Could not detect a table structure (comma/tab/pipe columns) in this file — it may be unstructured free text rather than a lead list."
    );
  }

  if (rows.length > MAX_ROWS) {
    warnings.push(`File has ${rows.length} rows — only the first ${MAX_ROWS} were processed.`);
    rows = rows.slice(0, MAX_ROWS);
  }

  return { headers, rows, warnings };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") {
    // Rich text / formula result objects — best-effort text extraction.
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText((value as { result: ExcelJS.CellValue }).result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r: { text: string }) => r.text).join("");
    }
    return "";
  }
  return String(value);
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const warnings: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (err) {
    throw new Error(`Could not read this spreadsheet: ${err instanceof Error ? err.message : "invalid file"}`);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    return { headers: [], rows: [], warnings: ["The workbook has no sheets or is empty."] };
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const text = cellText(cell.value).trim();
    if (text) headers.push(text);
  });

  if (headers.length === 0) {
    return { headers: [], rows: [], warnings: ["Could not find a header row in the first sheet."] };
  }

  const rows: Record<string, string>[] = [];
  const totalRows = worksheet.rowCount;
  const lastRow = Math.min(totalRows, MAX_ROWS + 1);
  for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    if (row.cellCount === 0) continue;
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const text = cellText(row.getCell(idx + 1).value).trim();
      record[header] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push(record);
  }

  if (workbook.worksheets.length > 1) {
    warnings.push(`Workbook has ${workbook.worksheets.length} sheets — only "${worksheet.name}" (the first) was imported.`);
  }
  if (totalRows > MAX_ROWS + 1) {
    warnings.push(`Sheet has ${totalRows - 1} rows — only the first ${MAX_ROWS} were processed.`);
  }

  return { headers, rows, warnings };
}

// PDF seller lists come in three real shapes: a clean exported table, a
// non-tabular document (a paragraph per seller, or a mail-merge-style
// letter list), or a scanned/image page with no extractable text at all.
// This runs all three stages in order and only gives up at the end.
//
// Stage A — extract raw text via pdf-parse, then detect the scanned case
// before doing anything else (near-zero text per page is the tell).
// Stage B — try to read it as a whitespace-column table (existing sellers
// lists exported from a spreadsheet often look like this in PDF).
// Stage C — if there's no usable table, segment the text into per-seller
// blocks (blank-line paragraphs, or a name-line heuristic when the PDF
// extractor collapsed everything into one paragraph) and pull seller name /
// address / phone / email / APN / price / distress signals out of each
// block with field-pattern matching — not a column position. Output uses
// the same header vocabulary column-map.ts already recognizes ("Seller",
// "Property Address", "Phone", ...) so it flows through the normal
// mapColumns → normalizeRow → dedupe pipeline unchanged.
async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err) {
    throw new Error(`Could not read this PDF: ${err instanceof Error ? err.message : "parse failed"}`);
  }

  const numpages = pdf.numPages || 1;

  // Reconstruct per-row, tab-delimited lines from real glyph positions —
  // both for Stage B (table columns) and, flattened, for Stage C (plain
  // text). Doing this once up front avoids extracting the document twice.
  const tableLines: string[] = [];
  let totalChars = 0;
  for (let pageNum = 1; pageNum <= numpages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    totalChars += content.items.reduce((sum: number, it) => sum + ((it as { str?: string }).str?.length ?? 0), 0);
    tableLines.push(...reconstructRows(content.items as PdfTextItem[]));
  }

  // ── Stage D check — a scanned/image PDF yields ~zero real glyph text ──
  if (totalChars / numpages < 25) {
    return {
      headers: [],
      rows: [],
      warnings: ["This PDF appears to be scanned and needs OCR — it contains little or no extractable text."],
    };
  }

  const filteredLines = tableLines.filter(
    (l) => l.trim().length > 0 && !/^page\s+\d+(\s+of\s+\d+)?$/i.test(l.trim()) && !/^\d{1,4}$/.test(l.trim())
  );

  if (filteredLines.length === 0) {
    return { headers: [], rows: [], warnings: ["No extractable text found in this PDF."] };
  }

  // ── Stage B — table detection, using real tab-delimited columns ──
  const table = tryParsePdfTable(filteredLines);
  if (table) return table;

  // ── Stage C — unstructured seller-block extraction ──
  // extractText's own line breaks (from pdf.js's hasEOL per glyph run) are
  // more reliable for prose than the tab-reconstructed table lines above,
  // and mergePages keeps multi-page letters/blocks in one stream.
  const { text } = await extractText(pdf, { mergePages: true });
  const proseLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => !/^page\s+\d+(\s+of\s+\d+)?$/i.test(l.trim()) && !/^\d{1,4}$/.test(l.trim()));
  return parsePdfBlocks(proseLines);
}

type PdfTextItem = { str: string; width: number; height: number; transform: number[] };

/** Groups pdf.js text items into visual rows (by y-position) and joins each
 * row left-to-right, inserting a tab wherever the horizontal gap between
 * two items is much wider than the row's typical word-gap — the real
 * geometric signature of a table column boundary, as opposed to guessing
 * from whitespace in text that's already had its spacing normalized. */
function reconstructRows(items: PdfTextItem[]): string[] {
  const real = items.filter((it) => it.str.trim().length > 0);
  if (real.length === 0) return [];

  const rowsByY = new Map<number, PdfTextItem[]>();
  for (const item of real) {
    const y = Math.round(item.transform[5]);
    // Cluster items within 3 units of an existing row's y — pdf.js can emit
    // sub-pixel y jitter for glyphs on the same visual line.
    let key = y;
    for (const existingY of rowsByY.keys()) {
      if (Math.abs(existingY - y) <= 3) {
        key = existingY;
        break;
      }
    }
    if (!rowsByY.has(key)) rowsByY.set(key, []);
    rowsByY.get(key)!.push(item);
  }

  const sortedYs = [...rowsByY.keys()].sort((a, b) => b - a); // PDF y grows upward
  const lines: string[] = [];

  for (const y of sortedYs) {
    const rowItems = rowsByY.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
    // A relative "typical gap vs outlier" comparison breaks down when a row
    // is entirely single-word cells (every gap IS a column gap, so the
    // median of "all gaps" is itself already large) — an absolute
    // font-size-relative threshold is more robust. A normal inter-word
    // space at 10pt Helvetica is ~2.5-3pt; a real column gap is generally
    // several times that, so 1.3x the glyph height comfortably separates
    // the two without needing the row's own gap distribution as a baseline.
    const columnThreshold = Math.max(rowItems[0].height * 1.3, 8);

    let line = rowItems[0].str;
    for (let i = 1; i < rowItems.length; i++) {
      const prev = rowItems[i - 1];
      const gap = rowItems[i].transform[4] - (prev.transform[4] + prev.width);
      line += gap > columnThreshold ? "\t" : " ";
      line += rowItems[i].str;
    }
    lines.push(line.replace(/ {2,}/g, " ").trim());
  }

  return lines;
}

function tryParsePdfTable(lines: string[]): ParsedFile | null {
  // Real PDFs vary in how a table gets drawn: some position every cell
  // separately (reconstructRows' tab-insertion catches the real gap), some
  // draw an entire padded line as one string (no positional gap to find,
  // only literal repeated spaces survive). Try the geometric split first,
  // then fall back to a plain 2+-space split on the same lines.
  return (
    tryParsePdfTableWithSplitter(lines, (l) => l.split(/\t/)) ??
    tryParsePdfTableWithSplitter(lines, (l) => l.split(/\s{2,}/))
  );
}

function tryParsePdfTableWithSplitter(lines: string[], split: (line: string) => string[]): ParsedFile | null {
  const cellsOf = (line: string) => split(line).map((c) => c.trim()).filter(Boolean);

  const headerKeywords = ["owner", "seller", "name", "address", "phone", "apn", "parcel", "city", "price"];
  const headerIdx = lines.findIndex((l) => {
    const lower = l.toLowerCase();
    return headerKeywords.filter((k) => lower.includes(k)).length >= 2 && cellsOf(l).length >= 2;
  });
  if (headerIdx === -1) return null;

  const headers = cellsOf(lines[headerIdx]);
  if (headers.length < 2) return null;

  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const cells = cellsOf(lines[i]);
    if (cells.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  // A header row with no matching data rows isn't a real table — fall
  // through to block extraction rather than reporting zero usable rows.
  if (rows.length === 0) return null;

  return { headers, rows, warnings: [] };
}

// ── Stage C field-pattern matchers ────────────────────────────────────────
const RE_PHONE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const RE_CITY_STATE_ZIP = /^([A-Za-z][A-Za-z\s.'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/;
const RE_ZIP_ONLY = /\b\d{5}(?:-\d{4})?\b/;
const RE_STREET_ADDRESS = /^\d+[A-Za-z0-9\s.,#'-]{3,}$/;
const RE_APN = /(?:apn|parcel(?:\s*(?:id|number|no)?)?)[:\s#]+([a-z0-9-]{4,})/i;
const RE_MONEY = /\$\s?([\d,]+(?:\.\d{2})?)/;
const RE_NAME_LINE = /^([A-Z][a-zA-Z'.-]+(?:\s+[A-Z][a-zA-Z'.-]+){1,3})$/;

const DISTRESS_KEYWORDS = [
  "tax delinquent", "delinquent tax", "back taxes", "behind on taxes",
  "foreclosure", "pre-foreclosure", "preforeclosure", "notice of default",
  "probate", "inherited", "inheritance", "estate sale",
  "vacant", "condemned", "code violation", "fire damage", "distressed",
  "divorce", "bankruptcy", "tired landlord", "absentee owner",
];

function isFieldLine(line: string): boolean {
  return (
    RE_CITY_STATE_ZIP.test(line) ||
    RE_STREET_ADDRESS.test(line) ||
    RE_PHONE.test(line) ||
    RE_EMAIL.test(line) ||
    RE_APN.test(line) ||
    RE_MONEY.test(line)
  );
}

function looksLikeName(line: string): boolean {
  return RE_NAME_LINE.test(line.trim()) && !DISTRESS_KEYWORDS.some((k) => line.toLowerCase().includes(k));
}

/** Groups lines into one block per seller. Prefers blank-line paragraph
 * breaks (common in mail-merge/letter-style exports); falls back to
 * starting a new block whenever a name-shaped line appears after the
 * current block already has at least one address/phone/etc. field —
 * handles PDFs where extraction collapsed all paragraph breaks. */
function segmentIntoBlocks(rawLines: string[]): string[][] {
  // rawLines here still has blank-line info encoded as "" entries from the
  // caller's pre-filter having been skipped — segmentIntoBlocks receives
  // the ORIGINAL line list (blanks intact) so paragraph breaks are visible.
  const paragraphs: string[][] = [];
  let current: string[] = [];
  for (const line of rawLines) {
    if (line.trim() === "") {
      if (current.length) paragraphs.push(current);
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) paragraphs.push(current);

  const realParagraphs = paragraphs.filter((p) => p.length >= 2);
  if (realParagraphs.length >= 2) return realParagraphs;

  // No usable blank-line structure — do a name-triggered scan instead.
  const flat = paragraphs.flat();
  const blocks: string[][] = [];
  let block: string[] = [];
  let blockHasField = false;

  for (const line of flat) {
    const startsNew = looksLikeName(line) && block.length > 0 && blockHasField;
    if (startsNew || block.length >= 15) {
      blocks.push(block);
      block = [];
      blockHasField = false;
    }
    block.push(line);
    if (isFieldLine(line)) blockHasField = true;
  }
  if (block.length) blocks.push(block);

  return blocks;
}

function parsePdfBlocks(lines: string[]): ParsedFile {
  const blocks = segmentIntoBlocks(lines);
  const warnings: string[] = [];
  const rows: Record<string, string>[] = [];

  for (const block of blocks) {
    const blockText = block.join("\n");
    const row: Record<string, string> = {};

    const nameLine = block.find((l) => looksLikeName(l) && !isFieldLine(l));
    if (nameLine) row["Seller"] = nameLine;

    const cszMatch = blockText.match(RE_CITY_STATE_ZIP);
    const addressLine = block.find((l) => RE_STREET_ADDRESS.test(l) && !RE_PHONE.test(l));
    if (addressLine) row["Property Address"] = addressLine;
    if (cszMatch) {
      row["City"] = cszMatch[1].trim();
      row["State"] = cszMatch[2];
      row["Zip"] = cszMatch[3];
    } else {
      const zipMatch = blockText.match(RE_ZIP_ONLY);
      if (zipMatch) row["Zip"] = zipMatch[0];
    }

    const phoneMatch = blockText.match(RE_PHONE);
    if (phoneMatch) row["Phone"] = phoneMatch[0];

    const emailMatch = blockText.match(RE_EMAIL);
    if (emailMatch) row["Email"] = emailMatch[0];

    const apnMatch = blockText.match(RE_APN);
    if (apnMatch) row["APN"] = apnMatch[1];

    const moneyMatch = blockText.match(RE_MONEY);
    if (moneyMatch) row["Asking Price"] = moneyMatch[1];

    const foundDistress = DISTRESS_KEYWORDS.filter((k) => blockText.toLowerCase().includes(k));
    if (foundDistress.length) row["Motivation"] = foundDistress.join(", ");

    // Whatever wasn't captured as a specific field stays visible as notes —
    // "preserve as much information as possible" even when a line doesn't
    // match a known pattern.
    const capturedValues = new Set(Object.values(row));
    const leftover = block.filter((l) => !capturedValues.has(l) && l !== nameLine && l !== addressLine);
    if (leftover.length) row["Notes"] = leftover.join(" | ");

    if (row["Seller"] || row["Property Address"] || row["Phone"]) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    warnings.push(
      "No table and no recognizable seller/property blocks were found in this PDF — it may not contain a lead list."
    );
    return { headers: [], rows: [], warnings };
  }

  const headers = ["Seller", "Property Address", "City", "State", "Zip", "Phone", "Email", "APN", "Asking Price", "Motivation", "Notes"];
  warnings.push(`Read as unstructured text — found ${rows.length} likely seller/property block(s), not a formatted table.`);
  return { headers, rows, warnings };
}
