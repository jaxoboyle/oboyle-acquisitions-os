import { requestBigSteinJson } from "@/lib/ai/json-call";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

const MAX_PIPELINE_SIZE = 5;
const OVERDUE_BACKLOG_THRESHOLD = 5;

type ProofType = "screenshot" | "file" | "url" | "written" | "number" | "call_count" | "crm_activity" | "summary" | "other";

type GeneratedTask = {
  title: string;
  notes?: string;
  task_type?: string;
  priority?: "low" | "medium" | "high" | "critical";
  is_revenue_producing?: boolean;
  is_non_negotiable?: boolean;
  estimated_minutes?: number;
  due_date?: string;
  lead_id?: string;
  proof_type?: ProofType;
  proof_required?: string;
};

/**
 * Core task-pipeline loop: complete → verify → close → evaluate business
 * state → generate the single next highest-value task. Called after an
 * approved completion (see api/tasks/[id]/complete). Caps at
 * MAX_PIPELINE_SIZE active non-negotiables and is idempotent per
 * completedTaskId so a retried request never produces two replacements.
 */
export async function replenishTaskPipeline(
  userId: string,
  supabase: AnySupabaseClient,
  completedTaskId?: string
): Promise<{ task: Record<string, unknown> } | null> {
  if (completedTaskId) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("replaced_task_id", completedTaskId)
      .maybeSingle();
    if (existing) return null;
  }

  const { count: activeCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_non_negotiable", true)
    .eq("completed", false)
    .neq("status", "cancelled")
    .is("deleted_at", null);

  if ((activeCount ?? 0) >= MAX_PIPELINE_SIZE) return null;

  const today = new Date().toISOString().split("T")[0];

  const [
    { count: overdueTaskCount },
    { data: overdueLeads },
    { data: objectives },
    { data: revenueTarget },
    { data: activeDeals },
    { data: recentCompleted },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_non_negotiable", true)
      .eq("completed", false)
      .lt("due_date", new Date().toISOString())
      .is("deleted_at", null),

    supabase
      .from("leads")
      .select("id, seller_name, phone, stage, priority, next_follow_up_date, last_contact_date")
      .eq("user_id", userId)
      .lt("next_follow_up_date", today)
      .is("deleted_at", null)
      .not("stage", "in", '("closed","dead_lead")')
      .order("next_follow_up_date", { ascending: true })
      .limit(5),

    supabase
      .from("objectives")
      .select("level, title, progress_pct, revenue_target, revenue_actual")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .is("deleted_at", null)
      .order("level", { ascending: true }),

    supabase
      .from("revenue_targets")
      .select("target_main, collected, contracted_awaiting_closing, projected_pipeline, period_end")
      .eq("user_id", userId)
      .eq("period_type", "thirty_day")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("deals")
      .select("id, closing_status, assignment_fee, closing_date")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("closing_status", "eq", "closed")
      .limit(10),

    supabase
      .from("tasks")
      .select("title, task_type, completed_at")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("completed_at", { ascending: false })
      .limit(5),
  ]);

  const overdueBias =
    (overdueTaskCount ?? 0) > OVERDUE_BACKLOG_THRESHOLD || (overdueLeads?.length ?? 0) > 0
      ? "The overdue backlog below is significant. Bias strongly toward a task that directly clears the oldest or highest-priority overdue item rather than opening new scope."
      : "";

  const proposal =
    (await requestBigSteinJson<GeneratedTask>({
      instructions: `You are choosing the SINGLE next highest-value non-negotiable task for the operator, based on current business state. Never propose busywork — every task must be justified by the priority order already documented in your identity (revenue-producing seller activity first, administration last). ${overdueBias}

Respond with a JSON object matching exactly this shape:
{"title": string, "notes": string, "task_type": string, "priority": "low"|"medium"|"high"|"critical", "is_revenue_producing": boolean, "is_non_negotiable": true, "estimated_minutes": number, "due_date": string (ISO date, today or tomorrow) | null, "lead_id": string | null, "proof_type": "screenshot"|"file"|"url"|"written"|"number"|"call_count"|"crm_activity"|"summary"|"other", "proof_required": string (one sentence describing what evidence proves this was done)}`,
      userContent: JSON.stringify({
        overdue_task_count: overdueTaskCount ?? 0,
        overdue_leads: overdueLeads ?? [],
        active_objectives: objectives ?? [],
        revenue_progress: revenueTarget ?? null,
        active_deals: activeDeals ?? [],
        recently_completed_tasks: recentCompleted ?? [],
      }),
      maxTokens: 512,
    })) ?? fallbackTask(overdueLeads ?? []);

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: proposal.title,
      notes: proposal.notes ?? null,
      task_type: proposal.task_type ?? "other",
      priority: proposal.priority ?? "medium",
      is_revenue_producing: proposal.is_revenue_producing ?? true,
      is_non_negotiable: true,
      estimated_minutes: proposal.estimated_minutes ?? null,
      due_date: proposal.due_date ?? null,
      lead_id: proposal.lead_id ?? null,
      proof_type: proposal.proof_type ?? "summary",
      proof_required: proposal.proof_required ?? "Briefly describe what was done.",
      status: "not_started",
      generated_by: "big_stein",
      replaced_task_id: completedTaskId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[replenishTaskPipeline] insert failed", error);
    return null;
  }

  return { task: inserted };
}

type OverdueLead = { id: string; seller_name: string; last_contact_date: string | null };

// Deterministic fallback so the pipeline never goes silently empty if the
// model call fails or returns something unparseable.
function fallbackTask(overdueLeads: OverdueLead[]): GeneratedTask {
  const lead = overdueLeads[0];
  if (lead) {
    return {
      title: `Follow up with ${lead.seller_name}`,
      notes: `Overdue follow-up — last contacted ${lead.last_contact_date ?? "unknown"}.`,
      task_type: "follow_up",
      priority: "high",
      is_revenue_producing: true,
      is_non_negotiable: true,
      estimated_minutes: 30,
      lead_id: lead.id,
      proof_type: "crm_activity",
      proof_required: "Log the call outcome and next follow-up date on this lead.",
    };
  }
  return {
    title: "Make 10 seller outreach calls",
    notes: "No overdue leads queued — default revenue-producing action.",
    task_type: "calls",
    priority: "high",
    is_revenue_producing: true,
    is_non_negotiable: true,
    estimated_minutes: 60,
    proof_type: "call_count",
    proof_required: "Report number of calls made, contacts reached, and any follow-ups scheduled.",
  };
}
