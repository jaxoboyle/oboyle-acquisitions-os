import { verifyProof } from "./verify-proof";
import { determineProofRequirement } from "./proof-requirement";
import { replenishTaskPipeline } from "@/lib/pipeline/replenish";
import { runImport } from "@/lib/imports/run-import";
import { runBuyerImport } from "@/lib/imports/run-buyer-import";
import { todayISO } from "@/lib/utils";
import { getOwnedAttachment, ensureAttachmentText, type FileAttachmentRow } from "@/lib/files/repository";
import { selectRelevantContent } from "@/lib/files/chunk";
import { copyAttachmentToTaskProof, downloadAttachment } from "@/lib/files/storage";
import { IMAGE_MEDIA_TYPES } from "@/lib/files/types";
import type { ImageAttachment } from "./json-call";
import { fetchPropertyFacts, fetchSaleComps, isPropertyDataConfigured, PropertyDataNotConfiguredError } from "@/lib/arv/property-data";
import { selectComps, calculateArvFromComps, type SubjectProperty } from "@/lib/arv/comps";
import { calculateMao, calculateOfferRange, resolveActiveRepairs, DEFAULT_BUYER_PCT, DEFAULT_WHOLESALE_FEE } from "@/lib/arv/calculate";
import { saveAnalysis, getAnalysis, type AnalysisInsert, type CompRow } from "@/lib/arv/repository";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

type Result = {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
};

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: AnySupabaseClient,
  conversationId?: string | null
): Promise<Result> {
  try {
    switch (name) {
      case "get_today_tasks":
        return await getTodayTasks(userId, supabase);

      case "get_current_objectives":
        return await getCurrentObjectives(userId, supabase, input.level as number | undefined);

      case "get_financial_progress":
        return await getFinancialProgress(userId, supabase);

      case "get_weekly_metrics":
        return await getWeeklyMetrics(userId, supabase);

      case "get_overdue_followups":
        return await getOverdueFollowups(userId, supabase, (input.limit as number) ?? 10);

      case "get_lead":
        return await getLead(userId, supabase, input.lead_id as string);

      case "search_leads":
        return await searchLeads(userId, supabase, input.query as string, input.stage as string, (input.limit as number) ?? 10);

      case "get_buyer":
        return await getBuyer(userId, supabase, input.buyer_id as string);

      case "search_buyers":
        return await searchBuyers(userId, supabase, input.query as string, (input.limit as number) ?? 10);

      case "get_deal":
        return await getDeal(userId, supabase, input.deal_id as string);

      case "search_deals":
        return await searchDeals(userId, supabase, input);

      case "create_task":
        return await createTask(userId, supabase, input);

      case "update_task":
        return await updateTask(userId, supabase, input);

      case "complete_task":
        if (!input.confirmed) {
          return { success: false, requiresConfirmation: true, error: "User confirmation required before marking task complete." };
        }
        return await completeTask(userId, supabase, input);

      case "reschedule_task":
        return await rescheduleTask(userId, supabase, input);

      case "add_crm_note":
        return await addCrmNote(userId, supabase, input);

      case "create_followup":
        return await createFollowup(userId, supabase, input);

      case "save_decision":
        return await saveDecision(userId, supabase, input);

      case "record_blocker":
        return await recordBlocker(userId, supabase, input);

      case "get_time_summary":
        return await getTimeSummary(userId, supabase, (input.period as string) ?? "today");

      case "get_clockout_reason_summary":
        return await getClockoutReasonSummary(userId, supabase, (input.period as string) ?? "week");

      case "import_leads_from_file":
        return await importLeadsFromFile(userId, supabase, input.batch_id as string);

      case "import_buyers_from_file":
        return await importBuyersFromFile(userId, supabase, input.batch_id as string);

      case "get_import_batches":
        return await getImportBatches(userId, supabase, (input.limit as number) ?? 10);

      case "read_attachment":
        return await readAttachment(userId, supabase, input.attachment_id as string, input.query as string | undefined);

      case "list_attachments":
        return await listAttachments(userId, supabase, conversationId ?? null, (input.limit as number) ?? 10);

      case "search_tasks":
        return await searchTasks(userId, supabase, input.query as string, (input.limit as number) ?? 10);

      case "attach_file_to_task":
        return await attachFileToTask(
          userId,
          supabase,
          input.attachment_id as string,
          input.task_id as string,
          input.note as string | undefined
        );

      case "set_lead_disposition":
        if (input.disposition === "under_contract" && !input.confirmed) {
          return {
            success: false,
            requiresConfirmation: true,
            error: "User confirmation required before marking a lead Under Contract — this creates a real Deal record.",
          };
        }
        return await setLeadDisposition(userId, supabase, input);

      case "list_followups":
        return await listFollowups(userId, supabase, (input.bucket as string) ?? "all", input.within_days as number | undefined);

      case "run_arv_analysis":
        return await runArvAnalysis(userId, supabase, input);

      case "get_arv_analysis":
        return await getArvAnalysisTool(userId, supabase, input);

      case "recalculate_mao":
        return await recalculateMaoTool(userId, supabase, input);

      case "save_arv_analysis_to_lead":
        return await saveArvAnalysisToLead(userId, supabase, input);

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[Tool ${name} error]`, err);
    return { success: false, error: `Tool execution failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function getTodayTasks(userId: string, supabase: AnySupabaseClient): Promise<Result> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, is_non_negotiable, is_revenue_producing, priority, estimated_minutes, actual_minutes, due_date, scheduled_start, notes, blocker_description")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(`due_date.gte.${today}T00:00:00,due_date.lte.${today}T23:59:59,scheduled_start.gte.${today}T00:00:00,scheduled_start.lte.${today}T23:59:59`)
    .order("is_non_negotiable", { ascending: false })
    .order("scheduled_start", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getCurrentObjectives(userId: string, supabase: AnySupabaseClient, level?: number): Promise<Result> {
  let query = supabase
    .from("objectives")
    .select("id, level, title, description, status, progress_pct, start_date, end_date, revenue_target, revenue_actual, success_criteria")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .order("level", { ascending: true });

  if (level) query = query.eq("level", level);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getFinancialProgress(userId: string, supabase: AnySupabaseClient): Promise<Result> {
  const { data, error } = await supabase
    .from("revenue_targets")
    .select("*")
    .eq("user_id", userId)
    .eq("period_type", "thirty_day")
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  if (error) return { success: false, error: error.message };

  const today = new Date();
  const end = new Date(data.period_end);
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const gap = Math.max(data.target_main - data.collected, 0);
  const weeklyPaceRequired = daysRemaining > 0 ? (gap / daysRemaining) * 7 : 0;

  return {
    success: true,
    data: {
      ...data,
      gap,
      days_remaining: daysRemaining,
      weekly_pace_required: weeklyPaceRequired,
      note: "projected_pipeline is potential revenue only — it has not been earned or collected.",
    },
  };
}

async function getWeeklyMetrics(userId: string, supabase: AnySupabaseClient): Promise<Result> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);

  const [{ data: workdays }, { data: activities }] = await Promise.all([
    supabase
      .from("workdays")
      .select("work_date, actual_minutes, target_minutes")
      .eq("user_id", userId)
      .gte("work_date", weekStart.toISOString().split("T")[0]),
    supabase
      .from("activity_log")
      .select("activity_type, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekStart.toISOString()),
  ]);

  const totalMinutes = (workdays ?? []).reduce((sum, d) => sum + d.actual_minutes, 0);
  const targetMinutes = (workdays ?? []).reduce((sum, d) => sum + d.target_minutes, 0);

  const activityCounts: Record<string, number> = {};
  for (const a of activities ?? []) {
    activityCounts[a.activity_type] = (activityCounts[a.activity_type] ?? 0) + 1;
  }

  return {
    success: true,
    data: {
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      target_hours: Math.round((targetMinutes / 60) * 10) / 10,
      days_worked: (workdays ?? []).length,
      activity_counts: activityCounts,
    },
  };
}

async function getOverdueFollowups(userId: string, supabase: AnySupabaseClient, limit: number): Promise<Result> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("leads")
    .select("id, seller_name, phone, stage, priority, next_follow_up_date, last_contact_date, address, city, state")
    .eq("user_id", userId)
    .lt("next_follow_up_date", today)
    .is("deleted_at", null)
    .not("stage", "in", '("closed","dead_lead")')
    .order("next_follow_up_date", { ascending: true })
    .limit(limit);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getLead(userId: string, supabase: AnySupabaseClient, leadId: string): Promise<Result> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchLeads(userId: string, supabase: AnySupabaseClient, query: string, stage?: string, limit = 10): Promise<Result> {
  let q = supabase
    .from("leads")
    .select("id, seller_name, phone, email, stage, priority, address, city, state, arv, estimated_assignment_fee, next_follow_up_date")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(`seller_name.ilike.%${query}%,address.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(limit);

  if (stage) q = q.eq("stage", stage);

  const { data, error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getBuyer(userId: string, supabase: AnySupabaseClient, buyerId: string): Promise<Result> {
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .eq("id", buyerId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchBuyers(userId: string, supabase: AnySupabaseClient, query: string, limit = 10): Promise<Result> {
  const { data, error } = await supabase
    .from("buyers")
    .select("id, buyer_name, company_name, phone, email, areas, property_types, funding_type, max_purchase_price")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(`buyer_name.ilike.%${query}%,areas.ilike.%${query}%,company_name.ilike.%${query}%`)
    .limit(limit);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getDeal(userId: string, supabase: AnySupabaseClient, dealId: string): Promise<Result> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("user_id", userId)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchDeals(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  let q = supabase
    .from("deals")
    .select("id, lead_id, closing_status, assignment_fee, closing_date, title_status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit((input.limit as number) ?? 10);

  if (input.closing_status) q = q.eq("closing_status", input.closing_status as string);

  const { data, error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function createTask(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title as string,
      notes: input.notes as string | undefined,
      task_type: (input.task_type as string) ?? "other",
      due_date: input.due_date as string | undefined,
      priority: (input.priority as "low" | "medium" | "high" | "critical") ?? "medium",
      is_revenue_producing: (input.is_revenue_producing as boolean) ?? false,
      estimated_minutes: input.estimated_minutes as number | undefined,
      lead_id: input.lead_id as string | undefined,
      is_non_negotiable: (input.is_non_negotiable as boolean) ?? false,
      status: "not_started",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function updateTask(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.due_date !== undefined) updates.due_date = input.due_date;
  if (input.completion_pct !== undefined) updates.completion_pct = input.completion_pct;
  if (input.blocker_description !== undefined) updates.blocker_description = input.blocker_description;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", input.task_id as string)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// Shares the same verify-then-replenish pipeline as the UI completion route
// (api/tasks/[id]/complete) so a task closed through chat behaves identically
// to one closed through the Complete button — same proof standard, same
// pipeline replacement, no separate code path that could bypass either.
async function completeTask(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const taskId = input.task_id as string;

  const { data: task, error: loadError } = await supabase
    .from("tasks")
    .select("id, title, notes, lead_id, is_non_negotiable, proof_type, proof_required, completed")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (loadError || !task) return { success: false, error: "Task not found" };
  if (task.completed) return { success: false, error: "Task is already completed" };

  const verdict = await verifyProof(
    { title: task.title, notes: task.notes, proof_required: task.proof_required },
    { proof_type: task.proof_type ?? "summary", text: input.proof as string | undefined }
  );

  if (!verdict.approved) {
    const { error: rejectUpdateError } = await supabase
      .from("tasks")
      .update({
        proof_status: "rejected",
        proof_submitted: (input.proof as string) ?? null,
        proof_submitted_at: new Date().toISOString(),
        proof_rejection_reason: verdict.reason,
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (rejectUpdateError) {
      console.error("[complete_task tool] failed to persist proof rejection", rejectUpdateError);
    }

    return { success: false, error: `Proof rejected: ${verdict.reason}` };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed: true,
      completed_at: new Date().toISOString(),
      proof_status: "approved",
      proof_submitted: (input.proof as string) ?? null,
      proof_submitted_at: new Date().toISOString(),
      proof_rejection_reason: null,
      actual_minutes: input.actual_minutes as number | undefined,
      completion_pct: 100,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  if (task.lead_id) {
    await supabase.from("activity_log").insert({
      user_id: userId,
      lead_id: task.lead_id,
      activity_type: "task_completed",
      description: `Completed: ${task.title}`,
    });
  }

  let replacementTask: Record<string, unknown> | null = null;
  if (task.is_non_negotiable) {
    const replenished = await replenishTaskPipeline(userId, supabase, taskId);
    replacementTask = replenished?.task ?? null;
  }

  return { success: true, data: { ...data, replacementTask } };
}

async function rescheduleTask(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  // First get current task to append to reschedule history
  const { data: existing } = await supabase
    .from("tasks")
    .select("due_date, reschedule_history")
    .eq("id", input.task_id as string)
    .eq("user_id", userId)
    .single();

  const history = Array.isArray(existing?.reschedule_history) ? existing.reschedule_history : [];
  history.push({
    from_date: existing?.due_date,
    to_date: input.new_due_date,
    reason: input.reason,
    rescheduled_at: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from("tasks")
    .update({
      due_date: input.new_due_date as string,
      status: "rescheduled",
      reschedule_history: history,
    })
    .eq("id", input.task_id as string)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function addCrmNote(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  if (input.entity_type === "lead") {
    const { data, error } = await supabase
      .from("activity_log")
      .insert({
        user_id: userId,
        lead_id: input.entity_id as string,
        activity_type: (input.activity_type as string) ?? "note",
        description: input.note as string,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }
  return { success: false, error: `Notes for ${input.entity_type} not yet implemented` };
}

async function createFollowup(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  // Update lead's next_follow_up_date
  const { error: leadError } = await supabase
    .from("leads")
    .update({ next_follow_up_date: input.follow_up_date as string })
    .eq("id", input.lead_id as string)
    .eq("user_id", userId);

  if (leadError) return { success: false, error: leadError.message };

  // Create a follow-up task
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      lead_id: input.lead_id as string,
      task_type: "follow_up",
      title: `Follow up with seller`,
      notes: input.notes as string | undefined,
      due_date: input.follow_up_date as string,
      priority: "medium",
      is_revenue_producing: true,
      status: "not_started",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function saveDecision(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      decision_text: input.decision_text as string,
      rationale: input.rationale as string | undefined,
      lead_id: input.lead_id as string | undefined,
      deal_id: input.deal_id as string | undefined,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function recordBlocker(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase
    .from("blockers")
    .insert({
      user_id: userId,
      description: input.description as string,
      blocker_type: input.blocker_type as string | undefined,
      task_id: input.task_id as string | undefined,
      objective_id: input.objective_id as string | undefined,
      status: "open",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getTimeSummary(userId: string, supabase: AnySupabaseClient, period: string): Promise<Result> {
  const start = new Date();
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  const { data, error } = await supabase
    .from("time_entries")
    .select("task_id, duration_minutes, category, is_productive, is_revenue_producing")
    .eq("user_id", userId)
    .gte("started_at", start.toISOString());

  if (error) return { success: false, error: error.message };

  const summary: Record<string, number> = {};
  const taskMinutes = new Map<string, number>();
  let totalMinutes = 0;
  let revenueMinutes = 0;
  let productiveMinutes = 0;
  let unplannedMinutes = 0;

  for (const entry of data ?? []) {
    const mins = entry.duration_minutes ?? 0;
    totalMinutes += mins;
    if (entry.is_revenue_producing) revenueMinutes += mins;
    if (entry.is_productive) productiveMinutes += mins;
    summary[entry.category] = (summary[entry.category] ?? 0) + mins;
    if (entry.task_id) {
      taskMinutes.set(entry.task_id, (taskMinutes.get(entry.task_id) ?? 0) + mins);
    } else if (entry.category === "other") {
      unplannedMinutes += mins;
    }
  }

  // Real task titles/estimates for the tasks actually worked on this
  // period, so Big Stein can cite specifics rather than just totals.
  let topTasks: Array<{ title: string; actual_minutes: number; estimated_minutes: number | null }> = [];
  if (taskMinutes.size > 0) {
    const { data: taskRows } = await supabase
      .from("tasks")
      .select("id, title, estimated_minutes")
      .in("id", [...taskMinutes.keys()]);

    topTasks = (taskRows ?? [])
      .map((t) => ({ title: t.title, actual_minutes: taskMinutes.get(t.id) ?? 0, estimated_minutes: t.estimated_minutes }))
      .sort((a, b) => b.actual_minutes - a.actual_minutes)
      .slice(0, 10);
  }

  return {
    success: true,
    data: {
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      revenue_producing_hours: Math.round((revenueMinutes / 60) * 10) / 10,
      productive_hours: Math.round((productiveMinutes / 60) * 10) / 10,
      unplanned_work_hours: Math.round((unplannedMinutes / 60) * 10) / 10,
      by_category: Object.fromEntries(
        Object.entries(summary).map(([k, v]) => [k, Math.round((v / 60) * 10) / 10])
      ),
      top_tasks_by_time: topTasks,
    },
  };
}

async function getClockoutReasonSummary(userId: string, supabase: AnySupabaseClient, period: string): Promise<Result> {
  const start = new Date();
  if (period === "week") {
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  const { data, error } = await supabase
    .from("clockout_reasons")
    .select("reason_type, duration_minutes")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());

  if (error) return { success: false, error: error.message };

  const byType: Record<string, { count: number; total_minutes: number }> = {};
  for (const r of data ?? []) {
    if (!byType[r.reason_type]) byType[r.reason_type] = { count: 0, total_minutes: 0 };
    byType[r.reason_type].count += 1;
    byType[r.reason_type].total_minutes += r.duration_minutes ?? 0;
  }

  const ranked = Object.entries(byType)
    .map(([reason, stats]) => ({ reason, ...stats }))
    .sort((a, b) => b.total_minutes - a.total_minutes);

  return { success: true, data: ranked };
}

async function importLeadsFromFile(userId: string, supabase: AnySupabaseClient, batchId: string): Promise<Result> {
  if (!batchId) return { success: false, error: "batch_id is required." };
  const result = await runImport(userId, supabase, batchId);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.summary };
}

async function getImportBatches(userId: string, supabase: AnySupabaseClient, limit: number): Promise<Result> {
  const { data: batches, error } = await supabase
    .from("import_batches")
    .select("id, source_filename, file_type, status, total_rows, imported_count, duplicate_count, skipped_count, created_at, processed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { success: false, error: error.message };
  if (!batches?.length) return { success: true, data: [] };

  const batchIds = batches.map((b) => b.id);
  const { data: leadsFromBatches } = await supabase
    .from("leads")
    .select("import_batch_id, disposition")
    .in("import_batch_id", batchIds)
    .is("deleted_at", null);

  const stillActiveByBatch = new Map<string, number>();
  for (const lead of leadsFromBatches ?? []) {
    if (lead.disposition) continue; // dispositioned — no longer "active"
    stillActiveByBatch.set(lead.import_batch_id, (stillActiveByBatch.get(lead.import_batch_id) ?? 0) + 1);
  }

  const data = batches.map((b) => ({
    ...b,
    still_active_leads: stillActiveByBatch.get(b.id) ?? 0,
  }));

  return { success: true, data };
}

async function importBuyersFromFile(userId: string, supabase: AnySupabaseClient, batchId: string): Promise<Result> {
  if (!batchId) return { success: false, error: "batch_id is required." };
  const result = await runBuyerImport(userId, supabase, batchId);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.summary };
}

async function readAttachment(
  userId: string,
  supabase: AnySupabaseClient,
  attachmentId: string,
  query?: string
): Promise<Result> {
  if (!attachmentId) return { success: false, error: "attachment_id is required." };

  const { row, error: loadError } = await getOwnedAttachment(supabase, userId, attachmentId);
  if (loadError || !row) return { success: false, error: loadError ?? "Attachment not found." };

  if (row.extraction_status === "unsupported" || row.extraction_status === "failed") {
    return {
      success: false,
      error: row.warnings?.[0] ?? `This file ("${row.filename}") couldn't be read.`,
    };
  }

  const { text, error: textError } = await ensureAttachmentText(supabase, row);
  if (textError || !text) return { success: false, error: textError ?? "No readable content available for this file." };

  const selection = selectRelevantContent(text, query ?? null);

  return {
    success: true,
    data: {
      attachment_id: row.id,
      filename: row.filename,
      file_kind: row.file_kind,
      page_count: row.page_count,
      sheet_names: row.sheet_names,
      warnings: row.warnings,
      truncated: selection.truncated,
      truncation_note: selection.note,
      content: selection.content,
    },
  };
}

async function listAttachments(
  userId: string,
  supabase: AnySupabaseClient,
  conversationId: string | null,
  limit: number
): Promise<Result> {
  let q = supabase
    .from("file_attachments")
    .select("id, filename, file_kind, extraction_status, page_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (conversationId) q = q.eq("conversation_id", conversationId);

  const { data, error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchTasks(userId: string, supabase: AnySupabaseClient, query: string, limit: number): Promise<Result> {
  if (!query) return { success: false, error: "query is required." };

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, task_type, due_date, proof_type, proof_status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(`title.ilike.%${query}%,notes.ilike.%${query}%`)
    .order("due_date", { ascending: false })
    .limit(limit);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;

/** Task-proof counterpart to read_attachment — reuses the same
 * proof-requirement + verifyProof standard as the Complete Task modal and
 * the complete_task tool (see completeTask below) rather than inventing a
 * separate, looser check for chat-submitted proof. Copies the file into the
 * task-proof bucket so it flows through the existing download/verification
 * code path unmodified. */
async function attachFileToTask(
  userId: string,
  supabase: AnySupabaseClient,
  attachmentId: string,
  taskId: string,
  note?: string
): Promise<Result> {
  if (!attachmentId) return { success: false, error: "attachment_id is required." };
  if (!taskId) return { success: false, error: "task_id is required." };

  const { row: attachment, error: attachmentError } = await getOwnedAttachment(supabase, userId, attachmentId);
  if (attachmentError || !attachment) return { success: false, error: attachmentError ?? "Attachment not found." };
  if (!attachment.storage_path) return { success: false, error: "The original file is no longer available in storage." };

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, notes, task_type, category, lead_id, is_non_negotiable, proof_type, proof_required, completed")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (taskError || !task) return { success: false, error: "Task not found." };
  if (task.completed) return { success: false, error: "That task is already completed." };

  let proofType = task.proof_type as string | null;
  let proofRequired = task.proof_required as string | null;
  if (!proofType || !proofRequired) {
    const requirement = await determineProofRequirement(task);
    proofType = requirement.proof_type;
    proofRequired = requirement.proof_required;
    await supabase.from("tasks").update({ proof_type: proofType, proof_required: proofRequired }).eq("id", taskId).eq("user_id", userId);
  }

  const { path: proofPath, error: copyError } = await copyAttachmentToTaskProof(
    supabase,
    userId,
    taskId,
    attachment.storage_path,
    attachment.filename
  );
  if (copyError || !proofPath) return { success: false, error: copyError ?? "Could not attach the file to this task." };

  // Build the actual evidence to verify: a real image for a screenshot/photo
  // (same vision check the Complete Task modal gets), extracted text for
  // everything else — never just "a file was present."
  const images: ImageAttachment[] = [];
  let submissionText = note ?? "";

  if (attachment.file_kind === "image") {
    const bytes = await downloadAttachment(supabase, attachment.storage_path);
    const ext = attachment.filename.toLowerCase().split(".").pop() ?? "";
    const mediaType = IMAGE_MEDIA_TYPES[ext] as ImageAttachment["mediaType"] | undefined;
    if (bytes && mediaType && bytes.byteLength <= MAX_PROOF_IMAGE_BYTES) {
      images.push({ mediaType, base64: bytes.toString("base64") });
    } else {
      const { text } = await ensureAttachmentText(supabase, attachment as FileAttachmentRow);
      if (text) submissionText = [submissionText, text].filter(Boolean).join("\n\n");
    }
  } else {
    const { text } = await ensureAttachmentText(supabase, attachment as FileAttachmentRow);
    if (text) submissionText = [submissionText, text.slice(0, 6000)].filter(Boolean).join("\n\n");
  }

  const verdict = await verifyProof(
    { title: task.title, notes: task.notes, proof_required: proofRequired },
    { proof_type: proofType ?? "file", text: submissionText || undefined, file_paths: [proofPath] },
    images
  );

  const proofSummary = `${note ? `${note}\n\n` : ""}File: ${attachment.filename}`.trim();

  if (!verdict.approved) {
    await supabase
      .from("tasks")
      .update({
        proof_status: "rejected",
        proof_submitted: proofSummary,
        proof_submitted_at: new Date().toISOString(),
        proof_rejection_reason: verdict.reason,
        proof_file_paths: [proofPath],
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    return { success: false, error: `Proof not accepted: ${verdict.reason}`, data: { approved: false, reason: verdict.reason, task_id: taskId } };
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed: true,
      completed_at: new Date().toISOString(),
      completion_pct: 100,
      proof_status: "approved",
      proof_submitted: proofSummary,
      proof_submitted_at: new Date().toISOString(),
      proof_rejection_reason: null,
      proof_file_paths: [proofPath],
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };

  if (task.lead_id) {
    await supabase.from("activity_log").insert({
      user_id: userId,
      lead_id: task.lead_id,
      activity_type: "task_completed",
      description: `Completed: ${task.title} (proof: ${attachment.filename})`,
    });
  }

  let replacementTask: Record<string, unknown> | null = null;
  if (task.is_non_negotiable) {
    const replenished = await replenishTaskPipeline(userId, supabase, taskId);
    replacementTask = replenished?.task ?? null;
  }

  return { success: true, data: { approved: true, reason: verdict.reason, task: updatedTask, replacementTask } };
}

const DISPOSITION_LABELS: Record<string, string> = {
  under_contract: "Under Contract",
  follow_up: "Follow Up / Circle Back",
  not_interested: "Not Interested",
  bad_lead: "Bad Lead",
  no_response: "No Response",
  wrong_information: "Wrong Information",
  sold: "Sold / Already Sold",
  other: "Other",
};

async function setLeadDisposition(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const leadId = input.lead_id as string;
  const disposition = input.disposition as string;
  if (!leadId) return { success: false, error: "lead_id is required." };
  if (!disposition || !DISPOSITION_LABELS[disposition]) return { success: false, error: "A valid disposition is required." };

  if (disposition === "follow_up" && !input.follow_up_date) {
    return { success: false, error: "follow_up_date is required when disposition is 'follow_up'." };
  }
  if (disposition === "other" && !input.reason) {
    return { success: false, error: "reason is required when disposition is 'other'." };
  }

  if (disposition === "under_contract") {
    const { data: dealId, error } = await supabase.rpc("mark_lead_under_contract", {
      p_lead_id: leadId,
      p_reason: (input.reason as string) ?? null,
      p_notes: (input.notes as string) ?? null,
      p_contract_price: (input.contract_price as number) ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: { deal_id: dealId, lead_id: leadId, disposition } };
  }

  const reason = (input.reason as string) || DISPOSITION_LABELS[disposition];
  const updates: Record<string, unknown> = {
    disposition,
    disposition_reason: reason,
    disposition_notes: (input.notes as string) ?? null,
    disposed_at: new Date().toISOString(),
  };
  if (disposition === "follow_up") updates.next_follow_up_date = input.follow_up_date as string;

  const { data, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", leadId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await supabase.from("activity_log").insert({
    user_id: userId,
    lead_id: leadId,
    activity_type: "disposition_change",
    description: `Marked ${DISPOSITION_LABELS[disposition]}${reason && reason !== DISPOSITION_LABELS[disposition] ? `: ${reason}` : ""}`,
  });

  return { success: true, data };
}

async function listFollowups(
  userId: string,
  supabase: AnySupabaseClient,
  bucket: string,
  withinDays?: number
): Promise<Result> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, seller_name, phone, address, city, state, next_follow_up_date, disposition_notes, lead_source, stage")
    .eq("user_id", userId)
    .eq("disposition", "follow_up")
    .is("deleted_at", null)
    .order("next_follow_up_date", { ascending: true });

  if (error) return { success: false, error: error.message };

  const today = todayISO();
  const cutoff = withinDays != null ? addDaysISO(today, withinDays) : null;

  const grouped = {
    overdue: [] as typeof data,
    today: [] as typeof data,
    upcoming: [] as typeof data,
  };

  for (const lead of data ?? []) {
    const due = lead.next_follow_up_date;
    if (!due || due < today) grouped.overdue.push(lead);
    else if (due === today) grouped.today.push(lead);
    else if (!cutoff || due <= cutoff) grouped.upcoming.push(lead);
  }

  if (bucket === "all") return { success: true, data: grouped };
  if (bucket === "overdue") return { success: true, data: grouped.overdue };
  if (bucket === "today") return { success: true, data: grouped.today };
  if (bucket === "upcoming") return { success: true, data: grouped.upcoming };
  return { success: true, data: grouped };
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

// ── ARV / Cash Offer Calculator ──────────────────────────────────────────────

async function runArvAnalysis(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const address = input.address as string;
  if (!address?.trim()) return { success: false, error: "address is required." };

  const leadId = (input.lead_id as string) ?? null;
  if (leadId) {
    const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("user_id", userId).single();
    if (!lead) return { success: false, error: "Lead not found." };
  }

  const buyerPct = (input.buyer_pct as number) ?? DEFAULT_BUYER_PCT;
  const wholesaleFee = (input.wholesale_fee as number) ?? DEFAULT_WHOLESALE_FEE;

  if (!isPropertyDataConfigured()) {
    return {
      success: false,
      error: "No property/comps data provider is configured, so I can't automatically look up property facts or sold comps for this address. Ask the user to add comps manually in the ARV Calculator, or provide an ARV estimate directly.",
    };
  }

  try {
    const facts = await fetchPropertyFacts(address);
    const subject: SubjectProperty = {
      squareFootage: facts?.squareFootage ?? null,
      bedrooms: facts?.bedrooms ?? null,
      bathrooms: facts?.bathrooms ?? null,
      propertyType: facts?.propertyType ?? null,
      yearBuilt: facts?.yearBuilt ?? null,
    };

    const { comps: candidates } = await fetchSaleComps(address, subject);
    const scored = selectComps(candidates, subject);
    const arv = calculateArvFromComps(
      scored.map((c) => ({ soldPrice: c.soldPrice, squareFootage: c.squareFootage, similarityScore: c.similarityScore, included: c.included })),
      subject.squareFootage
    );

    if (!arv) {
      return { success: false, error: "No comparable sales were found for that address. Try a nearby address or ask the user for manual comps." };
    }

    const repairs = 0; // no photos available via this path — Big Stein has no image upload here
    const mao = calculateMao({ arv: arv.likely, buyerPct, repairs, wholesaleFee });
    const offerRange = calculateOfferRange(mao);

    const insert: AnalysisInsert = {
      lead_id: leadId,
      address,
      city: facts?.city ?? null,
      state: facts?.state ?? null,
      zip: facts?.zip ?? null,
      parcel_number: facts?.parcelNumber ?? null,
      property_type: facts?.propertyType ?? null,
      bedrooms: facts?.bedrooms ?? null,
      bathrooms: facts?.bathrooms ?? null,
      square_footage: facts?.squareFootage ?? null,
      lot_size_sqft: facts?.lotSizeSqft ?? null,
      year_built: facts?.yearBuilt ?? null,
      last_sale_date: facts?.lastSaleDate ?? null,
      last_sale_price: facts?.lastSalePrice ?? null,
      assessed_value: facts?.assessedValue ?? null,
      tax_annual_amount: facts?.taxAnnualAmount ?? null,
      property_data_source: facts ? "rentcast" : null,
      property_data_source_id: facts?.sourceId ?? null,
      property_data_retrieved_at: facts?.retrievedAt ?? null,
      property_data_raw: facts?.raw ?? null,
      arv_low: arv.low,
      arv_likely: arv.likely,
      arv_high: arv.high,
      arv_confidence: arv.confidence,
      arv_method: "weighted_price_per_sqft",
      repairs_ai_estimate: null,
      repairs_manual_override: null,
      repairs_final: repairs,
      repair_confidence: "low",
      repair_breakdown: null,
      repair_photo_source: "No photos available via Big Stein chat — manual repair estimate recommended.",
      repair_photos_analyzed_count: 0,
      buyer_pct: buyerPct,
      wholesale_fee: wholesaleFee,
      mao,
      offer_range_low: offerRange.low,
      offer_range_high: offerRange.high,
      notes: null,
    };

    const compRows: CompRow[] = scored.map((c) => ({
      address: c.address,
      sold_price: c.soldPrice,
      sold_date: c.soldDate,
      distance_miles: c.distanceMiles,
      square_footage: c.squareFootage,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      property_type: c.propertyType,
      year_built: c.yearBuilt,
      lot_size_sqft: c.lotSizeSqft,
      price_per_sqft: c.soldPrice && c.squareFootage ? Math.round((c.soldPrice / c.squareFootage) * 100) / 100 : null,
      similarity_score: c.similarityScore,
      included: c.included,
      is_manual: false,
      source: c.source,
      source_id: c.sourceId,
      source_url: c.sourceUrl,
      retrieved_at: c.retrievedAt,
      notes: null,
    }));

    const result = await saveAnalysis(supabase, userId, insert, compRows);
    if ("error" in result) return { success: false, error: result.error };

    return {
      success: true,
      data: {
        analysis_id: result.id,
        address,
        arv_low: arv.low,
        arv_likely: arv.likely,
        arv_high: arv.high,
        arv_confidence: arv.confidence,
        comps_used: arv.compsUsed,
        repairs,
        repair_note: "No photos were available to analyze — repairs default to $0 until a manual estimate is set (via recalculate_mao or the ARV Calculator).",
        buyer_pct: buyerPct,
        wholesale_fee: wholesaleFee,
        mao,
        offer_range_low: offerRange.low,
        offer_range_high: offerRange.high,
        linked_lead_id: leadId,
      },
    };
  } catch (err) {
    if (err instanceof PropertyDataNotConfiguredError) {
      return { success: false, error: "No property/comps data provider is configured." };
    }
    throw err;
  }
}

async function getArvAnalysisTool(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const analysisId = input.analysis_id as string | undefined;
  const leadId = input.lead_id as string | undefined;

  let id = analysisId;
  if (!id && leadId) {
    const { data } = await supabase
      .from("arv_analyses")
      .select("id")
      .eq("lead_id", leadId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    id = data?.id;
  }
  if (!id) return { success: false, error: "No analysis_id given and no analysis found for that lead_id." };

  const result = await getAnalysis(supabase, userId, id);
  if (!result) return { success: false, error: "Analysis not found." };
  return { success: true, data: result };
}

async function recalculateMaoTool(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const analysisId = input.analysis_id as string;
  if (!analysisId) return { success: false, error: "analysis_id is required." };

  const { data: analysis, error } = await supabase
    .from("arv_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .single();
  if (error || !analysis) return { success: false, error: "Analysis not found." };

  const buyerPct = (input.buyer_pct as number) ?? analysis.buyer_pct;
  const wholesaleFee = (input.wholesale_fee as number) ?? analysis.wholesale_fee;
  const repairsOverride = input.repairs_override != null ? (input.repairs_override as number) : analysis.repairs_manual_override;
  const repairs = resolveActiveRepairs(analysis.repairs_ai_estimate, repairsOverride);

  const mao = calculateMao({ arv: analysis.arv_likely, buyerPct, repairs, wholesaleFee });
  const offerRange = calculateOfferRange(mao);

  const { error: updateError } = await supabase
    .from("arv_analyses")
    .update({
      buyer_pct: buyerPct,
      wholesale_fee: wholesaleFee,
      repairs_manual_override: repairsOverride,
      repairs_final: repairs,
      mao,
      offer_range_low: offerRange.low,
      offer_range_high: offerRange.high,
    })
    .eq("id", analysisId)
    .eq("user_id", userId);
  if (updateError) return { success: false, error: updateError.message };

  if (analysis.lead_id) {
    await supabase.from("leads").update({ estimated_repair_costs: repairs, mao, offer_amount: offerRange.high }).eq("id", analysis.lead_id).eq("user_id", userId);
  }

  return {
    success: true,
    data: { analysis_id: analysisId, arv_likely: analysis.arv_likely, buyer_pct: buyerPct, wholesale_fee: wholesaleFee, repairs, mao, offer_range_low: offerRange.low, offer_range_high: offerRange.high },
  };
}

async function saveArvAnalysisToLead(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const analysisId = input.analysis_id as string;
  const leadId = input.lead_id as string;
  if (!analysisId || !leadId) return { success: false, error: "analysis_id and lead_id are required." };

  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("user_id", userId).single();
  if (!lead) return { success: false, error: "Lead not found." };

  const { data: analysis, error } = await supabase
    .from("arv_analyses")
    .update({ lead_id: leadId })
    .eq("id", analysisId)
    .eq("user_id", userId)
    .select("arv_likely, repairs_final, mao, offer_range_high")
    .single();
  if (error || !analysis) return { success: false, error: error?.message ?? "Analysis not found." };

  await supabase
    .from("leads")
    .update({ arv: analysis.arv_likely, estimated_repair_costs: analysis.repairs_final, mao: analysis.mao, offer_amount: analysis.offer_range_high })
    .eq("id", leadId)
    .eq("user_id", userId);

  return { success: true, data: { analysis_id: analysisId, lead_id: leadId } };
}
