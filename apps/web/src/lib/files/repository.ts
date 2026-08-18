import { extractWithVision } from "./vision";
import { downloadAttachment } from "./storage";
import { IMAGE_MEDIA_TYPES } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export type FileAttachmentRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  filename: string;
  mime_type: string | null;
  file_kind: string;
  storage_path: string | null;
  size_bytes: number | null;
  extraction_status: string;
  extraction_method: string | null;
  extracted_text: string | null;
  extracted_summary: string | null;
  page_count: number | null;
  sheet_names: string[] | null;
  warnings: string[];
  linked_import_batch_id: string | null;
  created_at: string;
};

/** Loads an attachment the caller already knows the ID of, scoped to the
 * requesting user (RLS backs this up too, but an explicit check gives a
 * clean error instead of a bare "not found"). */
export async function getOwnedAttachment(
  supabase: AnySupabaseClient,
  userId: string,
  attachmentId: string
): Promise<{ row: FileAttachmentRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("file_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Attachment not found. It may have been removed, or the ID is from a different conversation." };
  return { row: data as FileAttachmentRow, error: null };
}

/** Ensures an attachment's text is available, running the vision fallback
 * exactly once for images/scanned PDFs and caching the result back onto the
 * row so every later question about the same file is a plain DB read, not a
 * repeat AI call (see spec's "don't reparse every message" requirement). */
export async function ensureAttachmentText(
  supabase: AnySupabaseClient,
  attachment: FileAttachmentRow
): Promise<{ text: string | null; error: string | null }> {
  if (attachment.extracted_text) return { text: attachment.extracted_text, error: null };

  if (attachment.extraction_status !== "needs_vision") {
    return { text: null, error: "No readable content is available for this file." };
  }

  if (!attachment.storage_path) {
    return { text: null, error: "The original file is no longer available in storage." };
  }

  const bytes = await downloadAttachment(supabase, attachment.storage_path);
  if (!bytes) return { text: null, error: "Could not download the stored file." };

  const mediaType =
    attachment.file_kind === "pdf"
      ? "application/pdf"
      : IMAGE_MEDIA_TYPES[attachment.filename.toLowerCase().split(".").pop() ?? ""] ?? attachment.mime_type ?? "image/jpeg";

  const result = await extractWithVision({ mediaType, base64: bytes.toString("base64") }, attachment.filename);
  if (!result) {
    return { text: null, error: "Vision extraction is temporarily unavailable — try again in a moment." };
  }

  await supabase
    .from("file_attachments")
    .update({
      extraction_status: "ready",
      extraction_method: "vision",
      extracted_text: result.text,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attachment.id);

  return { text: result.text, error: null };
}
