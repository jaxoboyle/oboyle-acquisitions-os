import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { determineProofRequirement } from "@/lib/ai/proof-requirement";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: task, error: loadError } = await supabase
    .from("tasks")
    .select("id, title, notes, task_type, category, proof_type, proof_required")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (loadError || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (task.proof_type && task.proof_required) {
    return NextResponse.json({ proof_type: task.proof_type, proof_required: task.proof_required });
  }

  const requirement = await determineProofRequirement(task);

  await supabase
    .from("tasks")
    .update({ proof_type: requirement.proof_type, proof_required: requirement.proof_required })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json(requirement);
}
