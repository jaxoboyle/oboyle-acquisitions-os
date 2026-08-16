// Server-only file parsing for Big Stein seller-list imports. Never import
// this from a client component — exceljs/pdf-parse are large Node libraries
// that have no business in the browser bundle; they're only ever touched
// from the /api/chat/upload route handler.
//
// Uses exceljs rather than the more common `xlsx` (SheetJS) package: the
// npm-published `xlsx` build is stuck on 0.18.5 with unpatched high-severity
// prototype-pollution and ReDoS advisories (SheetJS only ships fixed builds
// through their own CDN now), which is not acceptable for a route that
// parses files uploaded by a user.
import Papa from "papaparse";
import ExcelJS from "exceljs";

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

// PDF lead lists are usually a text-extracted table where columns are
// separated by runs of whitespace (the original column gaps). This is
// best-effort — a scanned/image-only PDF or a non-tabular layout won't
// produce usable rows, and callers should treat 0 rows as a parse failure,
// not silently succeed with nothing.
async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  const warnings: string[] = [];
  // pdf-parse has no ESM types export; require keeps this Node-only code
  // out of any client bundle analysis entirely.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text: string }>;

  let text: string;
  try {
    const data = await pdfParse(buffer);
    text = data.text;
  } catch (err) {
    throw new Error(`Could not read this PDF: ${err instanceof Error ? err.message : "parse failed"}`);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], warnings: ["No extractable text found — this may be a scanned/image PDF."] };
  }

  // Column boundary heuristic: split on 2+ spaces or a tab.
  const splitLine = (line: string) => line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);

  const headerKeywords = ["owner", "seller", "name", "address", "phone", "apn", "parcel", "city", "price"];
  let headerIdx = lines.findIndex((l) => {
    const lower = l.toLowerCase();
    return headerKeywords.filter((k) => lower.includes(k)).length >= 2;
  });
  if (headerIdx === -1) headerIdx = 0;

  const headers = splitLine(lines[headerIdx]);
  if (headers.length < 2) {
    warnings.push("Could not detect a table header row in this PDF — treating the whole document as unstructured text.");
    return { headers: [], rows: [], warnings };
  }

  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    warnings.push("Detected a header row but no data rows matched its column structure.");
  }

  return { headers, rows, warnings };
}
