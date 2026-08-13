import { requestBigSteinJson } from "@/lib/ai/json-call";
import { toISODate, addDays, addYears, endOfCurrentMonth, endOfCurrentWeek } from "./period-math";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

type ExpiredObjective = {
  id: string;
  level: number;
  parent_id: string | null;
  title: string;
  description: string | null;
  success_criteria: string | null;
  progress_pct: number;
  start_date: string | null;
  end_date: string;
  revenue_target: number | null;
  revenue_actual: number | null;
};

const PARENT_LEVEL: Record<number, number> = { 4: 1, 5: 4, 6: 5, 7: 6, 8: 7 };

/**
 * Objective expiration / rollover: expired objective → Big Stein reviews
 * actual performance → records planned vs. actual → archives (status →
 * completed, never deleted) → creates the next objective at that level.
 * Idempotent — only touches rows still in_progress AND past end_date, so
 * repeat calls (page load, EOD review) are no-ops once caught up. Processes
 * top-down (annual → daily) so a successor always links to its parent's
 * freshest id, even when the parent expired in the same pass.
 */
export async function checkAndRolloverObjectives(userId: string, supabase: AnySupabaseClient): Promise<void> {
  const today = new Date();
  const todayStr = toISODate(today);

  const { data: expired } = await supabase
    .from("objectives")
    .select("id, level, parent_id, title, description, success_criteria, progress_pct, start_date, end_date, revenue_target, revenue_actual")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .lt("end_date", todayStr)
    .in("level", [4, 5, 6, 7, 8])
    .order("level", { ascending: true });

  if (!expired?.length) return;

  const freshParentByLevel = new Map<number, string>();
  for (const obj of expired as ExpiredObjective[]) {
    await rolloverOne(userId, supabase, obj, freshParentByLevel, today);
  }
}

async function rolloverOne(
  userId: string,
  supabase: AnySupabaseClient,
  obj: ExpiredObjective,
  freshParentByLevel: Map<number, string>,
  today: Date
): Promise<void> {
  const windowStart = obj.start_date ?? obj.end_date;
  const windowEndTs = `${obj.end_date}T23:59:59.999Z`;

  const [{ data: tasksInWindow }, { data: activityInWindow }] = await Promise.all([
    supabase
      .from("tasks")
      .select("completed")
      .eq("user_id", userId)
      .gte("created_at", `${windowStart}T00:00:00.000Z`)
      .lte("created_at", windowEndTs),
    supabase
      .from("activity_log")
      .select("activity_type")
      .eq("user_id", userId)
      .gte("created_at", `${windowStart}T00:00:00.000Z`)
      .lte("created_at", windowEndTs),
  ]);

  const tasksCompleted = (tasksInWindow ?? []).filter((t) => t.completed).length;
  const tasksTotal = (tasksInWindow ?? []).length;

  const result = await requestBigSteinJson<{
    analysis: string;
    actual_progress_pct: number;
    next_title: string;
    next_description: string;
    next_success_criteria: string;
  }>({
    instructions: `An objective's time period just ended. Compare what was planned against what actually happened, using ONLY the real data given below — no generic filler, no invented numbers. Then draft the next objective at the same level, informed by this result — if performance fell short, the next objective should account for that honestly rather than just repeating the same target unchanged.

Respond with a JSON object matching exactly this shape:
{"analysis": string (2-4 sentences, planned vs actual, honest), "actual_progress_pct": number (0-100), "next_title": string, "next_description": string, "next_success_criteria": string}`,
    userContent: JSON.stringify({
      level: obj.level,
      title: obj.title,
      description: obj.description,
      success_criteria: obj.success_criteria,
      period: { start: obj.start_date, end: obj.end_date },
      revenue_target: obj.revenue_target,
      revenue_actual: obj.revenue_actual,
      recorded_progress_pct: obj.progress_pct,
      tasks_completed: tasksCompleted,
      tasks_total: tasksTotal,
      crm_activity_count: (activityInWindow ?? []).length,
    }),
    maxTokens: 500,
  });

  const analysis =
    result?.analysis ??
    `Period ended ${obj.end_date}. ${tasksCompleted}/${tasksTotal} tasks completed in this window. Automated review unavailable this time — revisit manually.`;
  const actualProgress = result?.actual_progress_pct ?? obj.progress_pct;

  await supabase
    .from("objectives")
    .update({ status: "completed", progress_pct: actualProgress, big_stein_evaluation: analysis })
    .eq("id", obj.id)
    .eq("user_id", userId);

  const parentLevel = PARENT_LEVEL[obj.level] ?? obj.level;
  const parentId = freshParentByLevel.get(parentLevel) ?? obj.parent_id;
  const { start, end } = nextPeriod(obj.level, today);

  const { data: created } = await supabase
    .from("objectives")
    .insert({
      user_id: userId,
      parent_id: parentId,
      level: obj.level,
      title: result?.next_title ?? `${obj.title} (continued)`,
      description: result?.next_description ?? obj.description,
      success_criteria: result?.next_success_criteria ?? obj.success_criteria,
      revenue_target: obj.revenue_target,
      status: "in_progress",
      progress_pct: 0,
      start_date: toISODate(start),
      end_date: toISODate(end),
    })
    .select("id")
    .single();

  if (created?.id) freshParentByLevel.set(obj.level, created.id);
}

// Always anchored to "today" rather than continuing precisely from the old
// end_date — robust regardless of exactly when the rollover check runs
// (page load / clock-out, not a fixed-time cron), and self-correcting if a
// check is missed for a few days.
function nextPeriod(level: number, today: Date): { start: Date; end: Date } {
  switch (level) {
    case 4:
      return { start: today, end: addYears(today, 1) };
    case 5:
      return { start: today, end: addDays(today, 90) };
    case 6:
      return { start: today, end: endOfCurrentMonth(today) };
    case 7:
      return { start: today, end: endOfCurrentWeek(today) };
    case 8:
    default:
      return { start: today, end: today };
  }
}
