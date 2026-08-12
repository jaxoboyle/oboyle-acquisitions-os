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
  supabase: AnySupabaseClient
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

async function completeTask(userId: string, supabase: AnySupabaseClient, input: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed: true,
      completed_at: new Date().toISOString(),
      proof_submitted: input.proof as string | undefined,
      proof_submitted_at: input.proof ? new Date().toISOString() : undefined,
      actual_minutes: input.actual_minutes as number | undefined,
      completion_pct: 100,
    })
    .eq("id", input.task_id as string)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
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
    .select("duration_minutes, category, is_productive, is_revenue_producing")
    .eq("user_id", userId)
    .gte("started_at", start.toISOString());

  if (error) return { success: false, error: error.message };

  const summary: Record<string, number> = {};
  let totalMinutes = 0;
  let revenueMinutes = 0;
  let productiveMinutes = 0;

  for (const entry of data ?? []) {
    const mins = entry.duration_minutes ?? 0;
    totalMinutes += mins;
    if (entry.is_revenue_producing) revenueMinutes += mins;
    if (entry.is_productive) productiveMinutes += mins;
    summary[entry.category] = (summary[entry.category] ?? 0) + mins;
  }

  return {
    success: true,
    data: {
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      revenue_producing_hours: Math.round((revenueMinutes / 60) * 10) / 10,
      productive_hours: Math.round((productiveMinutes / 60) * 10) / 10,
      by_category: Object.fromEntries(
        Object.entries(summary).map(([k, v]) => [k, Math.round((v / 60) * 10) / 10])
      ),
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
