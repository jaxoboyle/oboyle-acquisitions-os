import { requestBigSteinJson } from "./json-call";
import { checkAndRolloverObjectives } from "@/lib/objectives/rollover";
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
  task_time_breakdown: Array<{ title: string; minutes: number }>;
  unplanned_work_minutes: number;
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

  // Clocking out is the natural daily checkpoint — this is where today's
  // objective (and any weekly/monthly/etc. objective ending today) gets
  // archived with a real planned-vs-actual review and its successor
  // created, per the objective expiration/rollover system.
  await checkAndRolloverObjectives(userId, supabase);

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
      .select("task_id, category, duration_minutes, is_productive, is_revenue_producing, notes")
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

  // Real per-task time for today — this is what lets the review say "3.2
  // hours on seller calls, 45 minutes on follow-ups" instead of a vague
  // total, and what unplanned/unlabeled time actually cost today.
  const taskMinutesToday = new Map<string, number>();
  let unplannedMinutesToday = 0;
  for (const e of timeEntriesToday ?? []) {
    const mins = e.duration_minutes ?? 0;
    if (e.task_id) {
      taskMinutesToday.set(e.task_id, (taskMinutesToday.get(e.task_id) ?? 0) + mins);
    } else if (e.category === "other") {
      unplannedMinutesToday += mins;
    }
  }
  let taskTimeBreakdownToday: Array<{ title: string; minutes: number }> = [];
  if (taskMinutesToday.size > 0) {
    const { data: taskTitles } = await supabase.from("tasks").select("id, title").in("id", [...taskMinutesToday.keys()]);
    taskTimeBreakdownToday = (taskTitles ?? [])
      .map((t) => ({ title: t.title, minutes: taskMinutesToday.get(t.id) ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes);
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
    task_time_breakdown_today: taskTimeBreakdownToday,
    unplanned_work_minutes_today: unplannedMinutesToday,
    weekly_monthly_objectives: objectives ?? [],
  };

  const content = await requestBigSteinJson<EodReviewContent>({
    instructions: `Write today's End-of-Day CEO Review using ONLY the actual data provided below — no generic motivational filler, every claim grounded in the numbers given. Use task_time_breakdown_today to name specific tasks and how long they actually took (e.g. "3.2 hours on seller calls, 45 minutes on follow-ups") rather than speaking only in totals — this is the whole point of tracking it. Call out unplanned_work_minutes_today specifically if it's a meaningful chunk of the day.

Respond with a JSON object matching exactly this shape:
{"hours_worked": number, "target_hours": number, "tasks_completed": number, "tasks_active": number, "tasks_overdue": number, "seller_calls": number, "leads_generated": number, "follow_ups": number, "offers": number, "buyers_contacted": number, "deals_advanced": number, "task_time_breakdown": [{"title": string, "minutes": number}] (copy from task_time_breakdown_today, top 5 max), "unplanned_work_minutes": number (copy from unplanned_work_minutes_today), "what_went_well": string, "where_fell_short": string, "time_wasted": string, "score": number (0-10), "improvements": string[] (1-3 items), "weekly_progress_note": string, "next_priority": string}

Derive seller_calls/leads_generated/follow_ups/offers/buyers_contacted from activity_counts_today's activity_type keys (freeform strings like "call", "follow_up", "offer_sent", "buyer_contact" — match by substring). Default to 0 rather than guessing a number that isn't supported by the data.`,
    userContent: JSON.stringify(gatheredData),
    maxTokens: 1400,
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
