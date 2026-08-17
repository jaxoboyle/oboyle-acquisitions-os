import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runImport } from "@/lib/imports/run-import";

export const runtime = "nodejs";
export const maxDuration = 60;

// Confirms the seller-file preview shown in Big Stein chat ("Found 47
// seller records" + sample + Import Leads / Cancel) — a direct, deterministic
// commit rather than routing the click through the LLM, so it's fast and
// doesn't depend on Big Stein correctly inferring intent from a button press.
export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runImport(user.id, supabase, batchId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.summary);
}

// Cancel — the user attached a file but decided not to import it. Nothing
// was written to Leads yet (only the staged batch + raw file), so this is
// a plain delete, not a rollback.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: batch } = await supabase
    .from("import_batches")
    .select("storage_path")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (batch?.storage_path) {
    await supabase.storage.from("lead-imports").remove([batch.storage_path]);
  }

  await supabase.from("import_batches").delete().eq("id", batchId).eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
