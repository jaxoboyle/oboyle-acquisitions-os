// Storage helpers for the general-purpose `big-stein-files` bucket. Kept
// separate from the lead-imports/task-proof storage calls already scattered
// through the codebase so this layer's paths/bucket are the only thing that
// ever changes here.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export const BIG_STEIN_FILES_BUCKET = "big-stein-files";

export function buildAttachmentPath(userId: string, conversationId: string | null, fileId: string, filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const convSegment = conversationId ?? "unfiled";
  return `${userId}/${convSegment}/${fileId}/${safeFilename}`;
}

export async function uploadAttachment(
  supabase: AnySupabaseClient,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(BIG_STEIN_FILES_BUCKET)
    .upload(path, buffer, { contentType: contentType || "application/octet-stream" });
  return { error: error?.message ?? null };
}

export async function downloadAttachment(supabase: AnySupabaseClient, path: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(BIG_STEIN_FILES_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Copies a general attachment's bytes into the task-proof bucket so it can
 * flow through the existing, unmodified proof-verification/download logic
 * (which is hard-coded to bucket "task-proof" — see api/tasks/[id]/complete
 * and execute-tool.ts's completeTask). The JS client's storage `.copy()` only
 * works within one bucket, so this is a real download+upload rather than a
 * server-side copy. */
export async function copyAttachmentToTaskProof(
  supabase: AnySupabaseClient,
  userId: string,
  taskId: string,
  sourcePath: string,
  filename: string
): Promise<{ path: string | null; error: string | null }> {
  const bytes = await downloadAttachment(supabase, sourcePath);
  if (!bytes) return { path: null, error: "Could not read the attached file from storage." };

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destPath = `${userId}/${taskId}/${Date.now()}-${safeFilename}`;
  const { error } = await supabase.storage.from("task-proof").upload(destPath, bytes);
  if (error) return { path: null, error: error.message };
  return { path: destPath, error: null };
}
