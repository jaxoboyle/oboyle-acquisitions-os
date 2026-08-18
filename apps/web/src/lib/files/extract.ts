// General-purpose file content extraction for the Big Stein file
// intelligence layer. Server-only — mammoth/exceljs/unpdf/jszip have no
// business in the browser bundle.
//
// This is intentionally independent of lib/imports/parse-file.ts. That
// module's whole job is "turn rows into Lead/Buyer candidates" and its PDF
// pipeline is tuned specifically for that (numbered-record detection,
// header-keyword table detection, etc). This module's job is "give the model
// the document's actual content to reason over" — a normal contract, a
// comp report, a spreadsheet answered by natural-language questions — which
// is a different shape of output (whole-document text with page/sheet
// boundaries) even though a handful of PDF/XLSX primitives are shared.
// Keeping them separate means nothing here can ever change what the Leads/
// Buyers importer does.
import ExcelJS from "exceljs";
import { getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import JSZip from "jszip";
import type { ExtractedFile, FileKind } from "./types";

const MAX_EXTRACTED_CHARS = 400_000;
const MAX_ROWS_PER_SHEET = 3000;

export async function extractFileContent(
  buffer: Buffer,
  kind: FileKind,
  filename: string
): Promise<ExtractedFile> {
  try {
    switch (kind) {
      case "pdf":
        return await extractPdf(buffer);
      case "csv":
      case "txt":
        return extractPlainText(buffer, kind);
      case "json":
        return extractJson(buffer);
      case "xlsx":
        return await extractXlsx(buffer);
      case "docx":
        return await extractDocx(buffer);
      case "pptx":
        return await extractPptx(buffer);
      case "rtf":
        return extractRtf(buffer);
      case "image":
        // No text extraction here — vision runs lazily on first read (see
        // lib/files/lazy-vision.ts) so an uploaded screenshot that's never
        // asked about never costs an AI call.
        return {
          kind,
          status: "needs_vision",
          method: null,
          text: null,
          summary: null,
          pageCount: null,
          sheetNames: null,
          warnings: [],
        };
      default:
        return {
          kind: "other",
          status: "unsupported",
          method: null,
          text: null,
          summary: null,
          pageCount: null,
          sheetNames: null,
          warnings: [`"${filename}" is not a supported file type yet. Try PDF, CSV, XLSX, DOCX, TXT, JSON, PNG, JPG, or WEBP.`],
        };
    }
  } catch (err) {
    return {
      kind,
      status: "failed",
      method: null,
      text: null,
      summary: null,
      pageCount: null,
      sheetNames: null,
      warnings: [`Could not read "${filename}": ${err instanceof Error ? err.message : "unknown error"}.`],
    };
  }
}

function capText(text: string, warnings: string[]): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  warnings.push(
    `This document is very large — only the first ~${Math.round(MAX_EXTRACTED_CHARS / 1000)}k characters were kept. Ask about a specific section for anything beyond that.`
  );
  return text.slice(0, MAX_EXTRACTED_CHARS);
}

function extractPlainText(buffer: Buffer, kind: FileKind): ExtractedFile {
  const text = buffer.toString("utf-8");
  const warnings: string[] = [];
  if (!text.trim()) {
    return { kind, status: "failed", method: "utf8", text: null, summary: null, pageCount: null, sheetNames: null, warnings: ["This file appears to be empty."] };
  }
  return {
    kind,
    status: "ready",
    method: "utf8",
    text: capText(text, warnings),
    summary: null,
    pageCount: null,
    sheetNames: null,
    warnings,
  };
}

function extractJson(buffer: Buffer): ExtractedFile {
  const raw = buffer.toString("utf-8");
  const warnings: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    return { kind: "json", status: "ready", method: "json", text: capText(pretty, warnings), summary: null, pageCount: null, sheetNames: null, warnings };
  } catch {
    // Not valid JSON — still hand back the raw text rather than failing outright.
    warnings.push("This file has a .json name but isn't valid JSON — showing the raw contents.");
    return { kind: "json", status: "ready", method: "raw", text: capText(raw, warnings), summary: null, pageCount: null, sheetNames: null, warnings };
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedFile> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err) {
    return {
      kind: "pdf",
      status: "failed",
      method: null,
      text: null,
      summary: null,
      pageCount: null,
      sheetNames: null,
      warnings: [`Could not open this PDF: ${err instanceof Error ? err.message : "invalid or password-protected file"}.`],
    };
  }

  const numpages = pdf.numPages || 1;
  let totalChars = 0;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numpages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>).map((it) => it.str ?? "").join(" ");
    totalChars += pageText.length;
    pageTexts.push(pageText.trim());
  }

  // Low text density per page — scanned/image PDF. Defer to vision on demand
  // rather than reading here (same "only pay for AI when needed" reasoning
  // as images).
  if (totalChars / numpages < 25) {
    return {
      kind: "pdf",
      status: "needs_vision",
      method: null,
      text: null,
      summary: null,
      pageCount: numpages,
      sheetNames: null,
      warnings: ["This PDF appears to be scanned — reading it will use vision on first request."],
    };
  }

  const warnings: string[] = [];
  const combined = pageTexts.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");

  return {
    kind: "pdf",
    status: "ready",
    method: "text",
    text: capText(combined, warnings),
    summary: null,
    pageCount: numpages,
    sheetNames: null,
    warnings,
  };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText((value as { result: ExcelJS.CellValue }).result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r: { text: string }) => r.text).join("");
    }
    return "";
  }
  return String(value);
}

async function extractXlsx(buffer: Buffer): Promise<ExtractedFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (err) {
    return {
      kind: "xlsx",
      status: "failed",
      method: null,
      text: null,
      summary: null,
      pageCount: null,
      sheetNames: null,
      warnings: [`Could not read this spreadsheet: ${err instanceof Error ? err.message : "invalid file"}.`],
    };
  }

  if (workbook.worksheets.length === 0) {
    return { kind: "xlsx", status: "failed", method: null, text: null, summary: null, pageCount: null, sheetNames: null, warnings: ["This workbook has no sheets."] };
  }

  const warnings: string[] = [];
  const sheetNames: string[] = [];
  const sheetTexts: string[] = [];

  for (const worksheet of workbook.worksheets) {
    sheetNames.push(worksheet.name);
    const rowCount = worksheet.rowCount;
    const lastRow = Math.min(rowCount, MAX_ROWS_PER_SHEET);
    if (rowCount > MAX_ROWS_PER_SHEET) {
      warnings.push(`Sheet "${worksheet.name}" has ${rowCount} rows — only the first ${MAX_ROWS_PER_SHEET} were included.`);
    }

    const lines: string[] = [];
    for (let r = 1; r <= lastRow; r++) {
      const row = worksheet.getRow(r);
      if (row.cellCount === 0) continue;
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => cells.push(cellText(cell.value).trim()));
      if (cells.some(Boolean)) lines.push(cells.join(" | "));
    }
    sheetTexts.push(`--- Sheet: ${worksheet.name} ---\n${lines.join("\n")}`);
  }

  return {
    kind: "xlsx",
    status: "ready",
    method: "cells",
    text: capText(sheetTexts.join("\n\n"), warnings),
    summary: null,
    pageCount: null,
    sheetNames,
    warnings,
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractedFile> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const warnings = result.messages
      .filter((m) => m.type === "error")
      .map((m) => m.message);
    if (!result.value.trim()) {
      return { kind: "docx", status: "failed", method: null, text: null, summary: null, pageCount: null, sheetNames: null, warnings: ["No readable text found in this document."] };
    }
    const capWarnings: string[] = [];
    return {
      kind: "docx",
      status: "ready",
      method: "mammoth",
      text: capText(result.value, capWarnings),
      summary: null,
      pageCount: null,
      sheetNames: null,
      warnings: [...warnings, ...capWarnings],
    };
  } catch (err) {
    return {
      kind: "docx",
      status: "failed",
      method: null,
      text: null,
      summary: null,
      pageCount: null,
      sheetNames: null,
      warnings: [`Could not read this Word document: ${err instanceof Error ? err.message : "invalid file"}.`],
    };
  }
}

// PPTX is a zip of slideN.xml files with runs of text in <a:t> tags — no
// heavy presentation-parsing dependency needed for "read the text on each
// slide," which is what a business-context read actually needs.
async function extractPptx(buffer: Buffer): Promise<ExtractedFile> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        return na - nb;
      });

    if (slideFiles.length === 0) {
      return { kind: "pptx", status: "failed", method: null, text: null, summary: null, pageCount: null, sheetNames: null, warnings: ["Could not find any slides in this file."] };
    }

    const warnings: string[] = [];
    const slideTexts: string[] = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async("text");
      const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      slideTexts.push(`--- Slide ${i + 1} ---\n${runs.join(" ")}`);
    }

    return {
      kind: "pptx",
      status: "ready",
      method: "xml",
      text: capText(slideTexts.join("\n\n"), warnings),
      summary: null,
      pageCount: slideFiles.length,
      sheetNames: null,
      warnings,
    };
  } catch (err) {
    return {
      kind: "pptx",
      status: "failed",
      method: null,
      text: null,
      summary: null,
      pageCount: null,
      sheetNames: null,
      warnings: [`Could not read this PowerPoint file: ${err instanceof Error ? err.message : "invalid file"}.`],
    };
  }
}

// Best-effort RTF → text: strip control words/groups. RTF is a niche format
// here and a full parser isn't worth a new dependency for it — this covers
// the common case (text with basic formatting) without pulling in an
// unmaintained package.
function extractRtf(buffer: Buffer): ExtractedFile {
  const raw = buffer.toString("utf-8");
  if (!/^\{\\rtf/.test(raw.trim())) {
    return { kind: "rtf", status: "failed", method: null, text: null, summary: null, pageCount: null, sheetNames: null, warnings: ["This doesn't look like a valid RTF file."] };
  }

  let text = raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const warnings: string[] = ["RTF was read with best-effort text extraction — some formatting or embedded objects may not be represented."];
  if (!text) {
    return { kind: "rtf", status: "failed", method: null, text: null, summary: null, pageCount: null, sheetNames: null, warnings: ["No readable text found in this RTF file."] };
  }
  text = capText(text, warnings);
  return { kind: "rtf", status: "ready", method: "stripped", text, summary: null, pageCount: null, sheetNames: null, warnings };
}
