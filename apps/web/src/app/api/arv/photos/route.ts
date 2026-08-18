import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAttachmentPath, uploadAttachment } from "@/lib/files/storage";
import { detectGeneralFileKind } from "@/lib/files/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Persists ARV-analysis photos into the existing general file-intelligence
// layer (file_attachments / big-stein-files bucket), tagged with
// arv_analysis_id, so they show up in "N photos analyzed" proof and can be
// re-read later. Called once an arv_analyses row exists (right after Save,
// or when adding more photos to an already-saved analysis).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded photos." }, { status: 400 });
  }

  const analysisId = formData.get("analysisId");
  if (typeof analysisId !== "string" || !analysisId) {
    return NextResponse.json({ error: "analysisId is required." }, { status: 400 });
  }

  const { data: analysis } = await supabase
    .from("arv_analyses")
    .select("id, repair_photos_analyzed_count")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .single();
  if (!analysis) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  const files = formData.getAll("images").filter((f): f is File => f instanceof File);
  const savedIds: string[] = [];

  for (const file of files) {
    if (file.size === 0 || file.size > MAX_FILE_BYTES) continue;
    const fileKind = detectGeneralFileKind(file.name, file.type);
    if (fileKind !== "image") continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = crypto.randomUUID();
    const path = buildAttachmentPath(user.id, null, fileId, file.name);
    const { error: storageError } = await uploadAttachment(supabase, path, buffer, file.type);
    if (storageError) continue;

    const { error: insertError } = await supabase.from("file_attachments").insert({
      id: fileId,
      user_id: user.id,
      filename: file.name,
      mime_type: file.type || null,
      file_kind: "image",
      storage_path: path,
      size_bytes: file.size,
      extraction_status: "ready",
      arv_analysis_id: analysisId,
    });
    if (!insertError) savedIds.push(fileId);
  }

  await supabase
    .from("arv_analyses")
    .update({ repair_photos_analyzed_count: (analysis.repair_photos_analyzed_count ?? 0) + savedIds.length })
    .eq("id", analysisId)
    .eq("user_id", user.id);

  return NextResponse.json({ savedIds, count: savedIds.length });
}
