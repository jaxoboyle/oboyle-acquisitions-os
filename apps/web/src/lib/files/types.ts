// Shared types for the general-purpose Big Stein file intelligence layer.
// This is deliberately separate from lib/imports/parse-file.ts's ParsedFile —
// that type is tuned for one job (rows destined for Leads/Buyers). This one
// is tuned for "give the model something it can read, chunk, and reason
// over," which is a different shape of problem (whole-document text, page/
// sheet boundaries, images) even when the underlying bytes are the same file.

export type FileKind = "pdf" | "csv" | "xlsx" | "docx" | "txt" | "json" | "image" | "pptx" | "rtf" | "other";

export type ExtractionStatus = "pending" | "ready" | "needs_vision" | "failed" | "unsupported";

export type ExtractedFile = {
  kind: FileKind;
  status: ExtractionStatus;
  method: string | null;
  text: string | null;
  summary: string | null;
  pageCount: number | null;
  sheetNames: string[] | null;
  warnings: string[];
};

const EXT_TO_KIND: Record<string, FileKind> = {
  pdf: "pdf",
  csv: "csv",
  xlsx: "xlsx",
  xls: "xlsx",
  docx: "docx",
  txt: "txt",
  json: "json",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  pptx: "pptx",
  rtf: "rtf",
};

const MIME_TO_KIND: Array<{ test: (m: string) => boolean; kind: FileKind }> = [
  { test: (m) => m === "application/pdf", kind: "pdf" },
  { test: (m) => m === "text/csv", kind: "csv" },
  { test: (m) => m.includes("spreadsheet") || m.includes("ms-excel"), kind: "xlsx" },
  { test: (m) => m.includes("wordprocessingml") || m === "application/msword", kind: "docx" },
  { test: (m) => m === "text/plain", kind: "txt" },
  { test: (m) => m === "application/json", kind: "json" },
  { test: (m) => m.startsWith("image/"), kind: "image" },
  { test: (m) => m.includes("presentationml") || m === "application/vnd.ms-powerpoint", kind: "pptx" },
  { test: (m) => m === "application/rtf" || m === "text/rtf", kind: "rtf" },
];

export function detectGeneralFileKind(filename: string, mimeType: string): FileKind | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (EXT_TO_KIND[ext]) return EXT_TO_KIND[ext];
  const byMime = MIME_TO_KIND.find((m) => m.test(mimeType || ""));
  return byMime?.kind ?? null;
}

export const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
