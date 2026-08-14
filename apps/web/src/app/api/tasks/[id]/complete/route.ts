import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyProof, type ProofSubmission } from "@/lib/ai/verify-proof";
import { replenishTaskPipeline } from "@/lib/pipeline/replenish";
import type { ImageAttachment } from "@/lib/ai/json-call";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 3;

const IMAGE_MEDIA_TYPES: Record<string, ImageAttachment["mediaType"]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function serializeProof(submission: ProofSubmission): string {
  const parts: string[] = [];
  if (submission.text) parts.push(submission.text);
  if (submission.number != null) parts.push(`Number: ${submission.number}`);
  if (submission.url) parts.push(`URL: ${submission.url}`);
  if (submission.file_paths?.length) parts.push(`Files: ${submission.file_paths.length} attached`);
  return parts.join("\n") || "(no written detail submitted)";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as ProofSubmission & { actual_minutes?: number };

  const { data: task, error: loadError } = await supabase
    .from("tasks")
    .select("id, title, notes, lead_id, is_non_negotiable, proof_required, completed")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (loadError || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.completed) return NextResponse.json({ error: "Task is already completed" }, { status: 400 });

  // Real proof, not just presence — download image proof and pass it as an
  // actual vision input to the verification call.
  const images: ImageAttachment[] = [];
  if ((body.proof_type === "screenshot" || body.proof_type === "file") && body.file_paths?.length) {
    for (const path of body.file_paths.slice(0, MAX_IMAGES)) {
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      const mediaType = IMAGE_MEDIA_TYPES[ext];
      if (!mediaType) continue;

      const { data: blob } = await supabase.storage.from("task-proof").download(path);
      if (!blob || blob.size > MAX_IMAGE_BYTES) continue;

      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      images.push({ mediaType, base64 });
    }
  }

  const verdict = await verifyProof(
    { title: task.title, notes: task.notes, proof_required: task.proof_required },
    body,
    images
  );

  const proofSummary = serializeProof(body);

  if (!verdict.approved) {
    const { error: rejectUpdateError } = await supabase
      .from("tasks")
      .update({
        proof_status: "rejected",
        proof_submitted: proofSummary,
        proof_submitted_at: new Date().toISOString(),
        proof_rejection_reason: verdict.reason,
        proof_file_paths: body.file_paths ?? [],
      })
      .eq("id", id)
      .eq("user_id", user.id);

    // The rejection reason shown to the user comes from Big Stein's verdict,
    // not this write — but if persisting the rejection itself failed (e.g. a
    // schema mismatch), that's a real problem worth surfacing loudly rather
    // than silently discarding, since the task would otherwise sit with a
    // stale proof_status forever.
    if (rejectUpdateError) {
      console.error("[tasks/complete] failed to persist proof rejection", rejectUpdateError);
    }

    return NextResponse.json({ approved: false, reason: verdict.reason });
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("tasks")
    .update({
      completed: true,
      status: "completed",
      completed_at: new Date().toISOString(),
      completion_pct: 100,
      proof_status: "approved",
      proof_submitted: proofSummary,
      proof_submitted_at: new Date().toISOString(),
      proof_rejection_reason: null,
      proof_file_paths: body.file_paths ?? [],
      // Only set actual_minutes when explicitly provided — the real total
      // is normally already accumulated from tracked work sessions (see
      // work-session.ts's _endActiveEntry), and omitting an unset field
      // here (rather than coercing to null) avoids wiping that history out
      // every time a task is completed without a manual override.
      ...(body.actual_minutes != null ? { actual_minutes: body.actual_minutes } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // activity_log requires a lead — only log when this task is tied to one.
  if (task.lead_id) {
    await supabase.from("activity_log").insert({
      user_id: user.id,
      lead_id: task.lead_id,
      activity_type: "task_completed",
      description: `Completed: ${task.title}`,
    });
  }

  let replacement: { task: Record<string, unknown> } | null = null;
  if (task.is_non_negotiable) {
    replacement = await replenishTaskPipeline(user.id, supabase, task.id);
  }

  return NextResponse.json({ approved: true, task: updatedTask, replacementTask: replacement?.task ?? null });
}
