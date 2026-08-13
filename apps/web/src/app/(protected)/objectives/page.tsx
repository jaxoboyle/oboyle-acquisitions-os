import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { ensureObjectiveHierarchy } from "@/lib/objectives/ensure-hierarchy";
import { checkAndRolloverObjectives } from "@/lib/objectives/rollover";
import { ObjectivesClient } from "./ObjectivesClient";

export default async function ObjectivesPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  // Keep the hierarchy alive and current every time this page is visited —
  // archives anything expired (with Big Stein's planned-vs-actual review)
  // and creates its successor, and seeds the chain from scratch if it's
  // never existed. Both are idempotent no-ops once caught up.
  await ensureObjectiveHierarchy(user.id, supabase);
  await checkAndRolloverObjectives(user.id, supabase);

  const { data: objectives } = await supabase
    .from("objectives")
    .select(
      "id, parent_id, level, title, description, why_it_matters, success_criteria, status, progress_pct, start_date, end_date, revenue_target, revenue_actual, big_stein_evaluation"
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("level", { ascending: true })
    .order("created_at", { ascending: false });

  return <ObjectivesClient objectives={objectives ?? []} />;
}
