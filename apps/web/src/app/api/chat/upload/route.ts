import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectFileType, parseFile } from "@/lib/imports/parse-file";
import { mapColumns } from "@/lib/imports/column-map";
import { normalizeRow } from "@/lib/imports/normalize-row";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — generous for a seller list, small enough to parse in-request

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 400 });
  }

  const file = formData.get("file");
  const conversationId = formData.get("conversationId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file attached." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }

  const fileType = detectFileType(file.name, file.type);
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type. Attach a CSV, XLSX, PDF, or TXT lead list." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let parsed;
  try {
    parsed = await parseFile(buffer, fileType);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not parse this file." },
      { status: 422 }
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          parsed.warnings[0] ??
          "No rows could be read from this file. It may be empty, image-only, or in an unsupported layout.",
      },
      { status: 422 }
    );
  }

  const columnMapping = mapColumns(parsed.headers);
  const normalizedRows = parsed.rows.map((row) => normalizeRow(row, columnMapping, { relaxValidity: parsed.relaxValidity }));
  const validCount = normalizedRows.filter((r) => r.valid).length;

  // Best-effort raw-file storage for reference — the import still proceeds
  // even if this fails, since the parsed rows (what actually matters) are
  // already in hand.
  let storagePath: string | null = null;
  const batchIdForPath = crypto.randomUUID();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const candidatePath = `${user.id}/${batchIdForPath}/${safeFilename}`;
  const { error: storageError } = await supabase.storage
    .from("lead-imports")
    .upload(candidatePath, buffer, { contentType: file.type || "application/octet-stream" });
  if (!storageError) storagePath = candidatePath;

  const { data: batch, error: insertError } = await supabase
    .from("import_batches")
    .insert({
      id: batchIdForPath,
      user_id: user.id,
      conversation_id: typeof conversationId === "string" && conversationId ? conversationId : null,
      source_filename: file.name,
      file_type: fileType,
      storage_path: storagePath,
      file_size_bytes: file.size,
      status: "staged",
      column_mapping: columnMapping,
      parsed_rows: normalizedRows,
      total_rows: normalizedRows.length,
    })
    .select("id, source_filename, file_type, total_rows")
    .single();

  if (insertError || !batch) {
    return NextResponse.json({ error: `Could not save the parsed file: ${insertError?.message}` }, { status: 500 });
  }

  return NextResponse.json({
    batch_id: batch.id,
    filename: batch.source_filename,
    file_type: batch.file_type,
    total_rows: batch.total_rows,
    valid_rows: validCount,
    likely_skipped: batch.total_rows - validCount,
    detected_columns: Object.entries(columnMapping)
      .filter(([, field]) => field)
      .map(([header, field]) => `${header} → ${field}`),
    warnings: parsed.warnings,
    sample: normalizedRows.slice(0, 5).map((r) => ({
      seller_name: r.seller_name,
      address: r.address,
      phone: r.phone,
      parcel_number: r.parcel_number,
    })),
  });
}
