import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectGeneralFileKind } from "@/lib/files/types";
import { extractFileContent } from "@/lib/files/extract";
import { buildAttachmentPath, uploadAttachment } from "@/lib/files/storage";
import { detectFileType, parseFile } from "@/lib/imports/parse-file";
import { mapColumns } from "@/lib/imports/column-map";
import { normalizeRow } from "@/lib/imports/normalize-row";
import { mapBuyerColumns } from "@/lib/imports/buyer-column-map";
import { normalizeBuyerRow } from "@/lib/imports/buyer-normalize-row";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // matches the big-stein-files bucket's file_size_limit

// General-purpose Big Stein attachment endpoint. This is the routing layer
// described in the spec: it (1) always runs the normal-content extraction so
// the file can be read/analyzed/compared regardless of what it turns out to
// be, and (2) ALSO — separately, non-destructively — checks whether the file
// looks like a structured seller or buyer list, staging an import_batches
// row via the exact same parseFile/mapColumns/normalizeRow pipeline
// /api/chat/upload already uses, so the working Leads importer is reused
// unchanged rather than duplicated. Staging a batch here never imports
// anything by itself — that still only happens when the user (via the
// deterministic button or a Big Stein tool call) explicitly asks for it.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 400 });
  }

  const file = formData.get("file");
  const conversationIdRaw = formData.get("conversationId");
  const conversationId = typeof conversationIdRaw === "string" && conversationIdRaw ? conversationIdRaw : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file attached." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }

  const fileKind = detectGeneralFileKind(file.name, file.type);
  if (!fileKind) {
    return NextResponse.json(
      { error: "Unsupported file type. Try PDF, CSV, XLSX, XLS, DOCX, TXT, JSON, PNG, JPG, JPEG, WEBP, PPTX, or RTF." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const extraction = await extractFileContent(buffer, fileKind, file.name);

  const fileId = crypto.randomUUID();
  const attachmentPath = buildAttachmentPath(user.id, conversationId, fileId, file.name);
  const { error: storageError } = await uploadAttachment(supabase, attachmentPath, buffer, file.type);
  if (storageError) {
    return NextResponse.json({ error: `Could not save the file: ${storageError}` }, { status: 500 });
  }

  // ── Also check: does this look like a structured seller/buyer list? ──
  // Only attempted for the four types the existing importer already knows
  // how to turn into rows. Never blocks or alters the general read/analyze
  // path above — this is purely additive.
  let importBatch: {
    batch_id: string;
    target_kind: "leads" | "buyers";
    total_rows: number;
    valid_rows: number;
    sample: Array<Record<string, string | null>>;
  } | null = null;

  const structuredType = detectFileType(file.name, file.type);
  if (structuredType) {
    try {
      const parsed = await parseFile(buffer, structuredType);
      if (parsed.rows.length > 0) {
        const leadMapping = mapColumns(parsed.headers);
        const buyerMapping = mapBuyerColumns(parsed.headers);
        const leadHits = Object.values(leadMapping).filter(Boolean).length;
        const buyerHits = Object.values(buyerMapping).filter(Boolean).length;
        // Ties favor 'leads' — same default this system has always had.
        const targetKind: "leads" | "buyers" = buyerHits > leadHits ? "buyers" : "leads";

        const normalizedRows =
          targetKind === "buyers"
            ? parsed.rows.map((row) => normalizeBuyerRow(row, buyerMapping))
            : parsed.rows.map((row) => normalizeRow(row, leadMapping, { relaxValidity: parsed.relaxValidity }));

        const validCount = normalizedRows.filter((r) => r.valid).length;

        if (validCount > 0) {
          const batchId = crypto.randomUUID();
          const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const batchStoragePath = `${user.id}/${batchId}/${safeFilename}`;
          const { error: batchStorageError } = await supabase.storage
            .from("lead-imports")
            .upload(batchStoragePath, buffer, { contentType: file.type || "application/octet-stream" });

          const columnMapping = targetKind === "buyers" ? buyerMapping : leadMapping;
          const { error: batchInsertError } = await supabase.from("import_batches").insert({
            id: batchId,
            user_id: user.id,
            conversation_id: conversationId,
            source_filename: file.name,
            file_type: structuredType,
            target_kind: targetKind,
            storage_path: batchStorageError ? null : batchStoragePath,
            file_size_bytes: file.size,
            status: "staged",
            column_mapping: columnMapping,
            parsed_rows: normalizedRows,
            total_rows: normalizedRows.length,
          });

          if (!batchInsertError) {
            importBatch = {
              batch_id: batchId,
              target_kind: targetKind,
              total_rows: normalizedRows.length,
              valid_rows: validCount,
              sample:
                targetKind === "buyers"
                  ? normalizedRows.slice(0, 5).map((r) => {
                      const b = r as ReturnType<typeof normalizeBuyerRow>;
                      return { primary: b.buyer_name, secondary: b.company_name, phone: b.phone, extra: b.areas };
                    })
                  : normalizedRows.slice(0, 5).map((r) => {
                      const l = r as ReturnType<typeof normalizeRow>;
                      return { primary: l.seller_name, secondary: l.address, phone: l.phone, extra: l.parcel_number };
                    }),
            };
          }
        }
      }
    } catch {
      // A structured-list parse failure is not a general-read failure —
      // the file still gets read/analyzed normally below. Silently skip
      // the import-staging attempt.
    }
  }

  const { data: attachmentRow, error: insertError } = await supabase
    .from("file_attachments")
    .insert({
      id: fileId,
      user_id: user.id,
      conversation_id: conversationId,
      filename: file.name,
      mime_type: file.type || null,
      file_kind: fileKind,
      storage_path: attachmentPath,
      size_bytes: file.size,
      extraction_status: extraction.status,
      extraction_method: extraction.method,
      extracted_text: extraction.text,
      extracted_summary: extraction.summary,
      page_count: extraction.pageCount,
      sheet_names: extraction.sheetNames,
      warnings: extraction.warnings,
      linked_import_batch_id: importBatch?.batch_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !attachmentRow) {
    return NextResponse.json({ error: `Could not save the file record: ${insertError?.message}` }, { status: 500 });
  }

  return NextResponse.json({
    attachment_id: fileId,
    filename: file.name,
    file_kind: fileKind,
    extraction: {
      status: extraction.status,
      warnings: extraction.warnings,
      preview: extraction.text ? extraction.text.slice(0, 400) : null,
      page_count: extraction.pageCount,
      sheet_names: extraction.sheetNames,
    },
    possible_import: importBatch,
  });
}
