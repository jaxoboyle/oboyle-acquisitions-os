import { requestBigSteinJson } from "./json-call";
import { todayISO } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export type EodReviewContent = {
  hours_worked: number;
  target_hours: number;
  tasks_completed: number;
  tasks_active: number;
  tasks_overdue: number;
  seller_calls: number;
  leads_generated: number;
  follow_ups: number;
  offers: number;
  buyers_contacted: number;
  deals_advanced: number;
  what_went_well: string;
  where_fell_short: string;
  time_wasted: string;
  score: number;
  improvements: string[];
  weekly_progress_note: string;
  next_priority: string;
};

/**
 * Built from ACTUAL workday data, never generic filler — gathers today's
 * hours, completed/active/overdue tasks, CRM activity, and objective
 * progress, then has Big Stein synthesize the CEO review grounded in those
 * numbers. Idempotent per day via workdays.eod_review_generated_at.
 */
export async function generateEodReview(
  userId: string,
  supabase: AnySupabaseClient
): Promise<{ report_id: string; content: EodReviewContent } | null> {
  const today = todayISO();

  const { data: workday } = await supabase
    .from("workdays")
    .select("id, actual_minutes, target_minutes, eod_review_generated_at")
    .eq("user_id", userId)
    .eq("work_date", today)
    .maybeSingle();

  if (!workday) return null;

  if (workday.eod_review_generated_at) {
    const { data: existing } = await supabase
      .from("reports")
      .select("id, content")
      .eq("user_id", userId)
      .eq("report_type", "daily")
      .eq("period_start", today)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return { report_id: existing.id, content: existing.content as EodReviewContent };
  }

  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  const [
    { data: tasksCompletedToday },
    { count: tasksActiveCount },
    { count: tasksOverdueCount },
    { data: activityToday },
    { count: leadsCreatedToday },
    { count: dealsUpdatedToday },
    { data: timeEntriesToday },
    { data: objectives },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, proof_type, proof_submitted, proof_status")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("completed_at", dayStart)
      .lte("completed_at", dayEnd),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", false)
      .neq("status", "cancelled")
      .is("deleted_at", null),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", false)
      .lt("due_date", new Date().toISOString())
      .is("deleted_at", null),

    supabase
      .from("activity_log")
      .select("activity_type")
      .eq("user_id", userId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),

    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("updated_at", dayStart)
      .lte("updated_at", dayEnd),

    supabase
      .from("time_entries")
      .select("category, duration_minutes, is_productive, is_revenue_producing")
      .eq("user_id", userId)
      .gte("started_at", dayStart)
      .lte("started_at", dayEnd),

    supabase
      .from("objectives")
      .select("level, title, progress_pct")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .is("deleted_at", null)
      .in("level", [6, 7]) // 6=monthly, 7=weekly
      .order("level", { ascending: true }),
  ]);

  const activityCountsToday: Record<string, number> = {};
  for (const a of activityToday ?? []) {
    activityCountsToday[a.activity_type] = (activityCountsToday[a.activity_type] ?? 0) + 1;
  }

  const gatheredData = {
    date: today,
    hours_worked: Math.round((workday.actual_minutes / 60) * 10) / 10,
    target_hours: Math.round((workday.target_minutes / 60) * 10) / 10,
    tasks_completed_today: tasksCompletedToday ?? [],
    tasks_active_count: tasksActiveCount ?? 0,
    tasks_overdue_count: tasksOverdueCount ?? 0,
    activity_counts_today: activityCountsToday,
    leads_created_today: leadsCreatedToday ?? 0,
    deals_updated_today: dealsUpdatedToday ?? 0,
    time_entries_today: timeEntriesToday ?? [],
    weekly_monthly_objectives: objectives ?? [],
  };

  const content = await requestBigSteinJson<EodReviewContent>({
    instructions: `Write today's End-of-Day CEO Review using ONLY the actual data provided below — no generic motivational filler, every claim grounded in the numbers given.

Respond with a JSON object matching exactly this shape:
{"hours_worked": number, "target_hours": number, "tasks_completed": number, "tasks_active": number, "tasks_overdue": number, "seller_calls": number, "leads_generated": number, "follow_ups": number, "offers": number, "buyers_contacted": number, "deals_advanced": number, "what_went_well": string, "where_fell_short": string, "time_wasted": string, "score": number (0-10), "improvements": string[] (1-3 items), "weekly_progress_note": string, "next_priority": string}

Derive seller_calls/leads_generated/follow_ups/offers/buyers_contacted from activity_counts_today's activity_type keys (freeform strings like "call", "follow_up", "offer_sent", "buyer_contact" — match by substring). Default to 0 rather than guessing a number that isn't supported by the data.`,
    userContent: JSON.stringify(gatheredData),
    maxTokens: 1200,
  });

  if (!content) return null;

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      report_type: "daily",
      period_start: today,
      period_end: today,
      content,
    })
    .select("id")
    .single();

  if (reportError || !report) return null;

  await supabase
    .from("workdays")
    .update({
      day_score: Math.round(content.score * 10),
      day_score_explanation: `${content.what_went_well} ${content.where_fell_short}`.trim(),
      eod_review_generated_at: new Date().toISOString(),
    })
    .eq("id", workday.id);

  return { report_id: report.id, content };
}
