import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeRepairPhotos, type RepairImageInput } from "@/lib/arv/repair-vision";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Runs (or re-runs, via "Recalculate Repairs") a photo-based repair estimate.
// Takes raw image files directly rather than requiring them to be uploaded
// to storage first — photos only get persisted (via /api/arv/photos) once
// the user actually saves the analysis to a Lead.
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

  const contextRaw = formData.get("context");
  const context = typeof contextRaw === "string" ? JSON.parse(contextRaw) : {};

  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({
      breakdown: null,
      total: 0,
      confidence: "low",
      confidenceReason: "No photos available — manual repair estimate recommended.",
      narrative: "",
      photoCount: 0,
      photoSource: "none",
    });
  }

  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Too many photos (max ${MAX_IMAGES}).` }, { status: 400 });
  }

  const images: RepairImageInput[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) continue;
    if (!SUPPORTED_MEDIA_TYPES.has(file.type)) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({ mediaType: file.type as RepairImageInput["mediaType"], base64: buffer.toString("base64") });
  }

  if (images.length === 0) {
    return NextResponse.json({ error: "No supported image files were found (use JPEG, PNG, GIF, or WEBP)." }, { status: 400 });
  }

  const result = await analyzeRepairPhotos(images, context);
  if (!result) {
    return NextResponse.json({ error: "Repair analysis failed. You can still enter a manual repair estimate." }, { status: 502 });
  }

  return NextResponse.json({
    breakdown: result.breakdown,
    total: result.total,
    confidence: result.confidence,
    confidenceReason: result.confidenceReason,
    narrative: result.narrative,
    photoCount: images.length,
    photoSource: `${images.length} photo${images.length === 1 ? "" : "s"} uploaded by user`,
  });
}
