import { toISODate, addYears, endOfCurrentMonth, endOfCurrentWeek } from "./period-math";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

type ActiveObjective = { id: string };

const VISION_TITLE = "Build O'Boyle Acquisition into a $100,000,000+ Real Estate Investment Company";

/**
 * Ensures the full 15-Year Vision → Annual → 90-Day → Monthly → Weekly →
 * Daily chain exists and is active. Idempotent — only creates whatever level
 * is currently missing an in_progress objective; never duplicates. Called
 * from the Objectives page and before task-pipeline generation so Big Stein
 * always has a real hierarchy to reason from instead of generating random
 * tasks.
 */
export async function ensureObjectiveHierarchy(userId: string, supabase: AnySupabaseClient): Promise<void> {
  const today = new Date();
  const todayStr = toISODate(today);

  // Steady-state (nothing missing, the overwhelmingly common case — this
  // runs on every single /objectives page load) used to cost 6 sequential
  // round trips, one getActive() call at a time waiting on the last. All
  // six levels are independent reads, so one query covering all of them
  // replaces that chain; only the levels found missing fall back to
  // individual create() calls, which DO have a real parent-id dependency.
  const { data: activeRows } = await supabase
    .from("objectives")
    .select("id, level, created_at")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .in("level", [1, 4, 5, 6, 7, 8])
    .order("created_at", { ascending: false });

  const activeByLevel = new Map<number, ActiveObjective>();
  for (const row of (activeRows ?? []) as Array<ActiveObjective & { level: number }>) {
    if (!activeByLevel.has(row.level)) activeByLevel.set(row.level, { id: row.id });
  }

  async function getActive(level: number): Promise<ActiveObjective | null> {
    return activeByLevel.get(level) ?? null;
  }

  async function create(level: number, parentId: string | null, fields: Record<string, unknown>): Promise<ActiveObjective | null> {
    const { data } = await supabase
      .from("objectives")
      .insert({
        user_id: userId,
        parent_id: parentId,
        level,
        status: "in_progress",
        progress_pct: 0,
        start_date: todayStr,
        ...fields,
      })
      .select("id")
      .single();
    return data ?? null;
  }

  // Level 1 — 15-Year Vision
  let vision = await getActive(1);
  if (!vision) {
    vision = await create(1, null, {
      title: VISION_TITLE,
      description:
        "Grow from single-family wholesaling into a repeatable acquisitions operation, then small commercial deals, neighborhood strip centers, larger shopping centers, and finally an institutional-quality commercial portfolio — six stages over roughly 15 years.",
      why_it_matters: "This is the destination every lower-level objective, task, and workday is building toward.",
      success_criteria: "Owned/controlled asset value reaches $100,000,000.",
      end_date: toISODate(addYears(today, 15)),
    });
  }
  if (!vision) return;

  // Level 4 — Annual
  let annual = await getActive(4);
  if (!annual) {
    const year = today.getFullYear();
    annual = await create(4, vision.id, {
      title: `${year} Objective: Build the Wholesale Capital-Generation Engine`,
      description:
        "Establish a repeatable seller-acquisition, deal-analysis, buyer-relationship, and follow-up system that reliably produces assignment revenue.",
      why_it_matters: "Stage 1 of the 15-year plan — capital and systems built here fund every later stage.",
      success_criteria: "A documented, repeatable acquisition process with consistent monthly assignment closings.",
      end_date: toISODate(addYears(today, 1)),
    });
  }
  if (!annual) return;

  // Level 5 — 90-Day
  let ninetyDay = await getActive(5);
  if (!ninetyDay) {
    ninetyDay = await create(5, annual.id, {
      title: `90-Day Sprint — starting ${todayStr}`,
      description:
        "Establish consistent revenue-producing activity: seller outreach volume, follow-up discipline, and at least one closed or under-contract assignment.",
      success_criteria: "Consistent weekly seller-contact volume and at least one deal moved to closing.",
      end_date: toISODate(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)),
    });
  }
  if (!ninetyDay) return;

  // Level 6 — Monthly (reuse the real configured revenue target if one exists)
  let monthly = await getActive(6);
  if (!monthly) {
    const [{ data: revenueTarget }, { data: settings }] = await Promise.all([
      supabase
        .from("revenue_targets")
        .select("target_main, period_end")
        .eq("user_id", userId)
        .eq("period_type", "thirty_day")
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("company_settings").select("thirty_day_revenue_target").eq("user_id", userId).maybeSingle(),
    ]);

    const target = revenueTarget?.target_main ?? settings?.thirty_day_revenue_target ?? 10000;
    const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    monthly = await create(6, ninetyDay.id, {
      title: `${monthName} Objective`,
      description: `Generate $${Number(target).toLocaleString()} in gross wholesale assignment revenue this month while building the seller-acquisition and follow-up system.`,
      success_criteria: "Target revenue collected or under signed contract by month end.",
      revenue_target: target,
      end_date: revenueTarget?.period_end ?? toISODate(endOfCurrentMonth(today)),
    });
  }
  if (!monthly) return;

  // Level 7 — Weekly
  let weekly = await getActive(7);
  if (!weekly) {
    weekly = await create(7, monthly.id, {
      title: `Week of ${todayStr}`,
      description: "Hit the weekly seller-contact and follow-up targets that keep the monthly revenue objective on pace.",
      success_criteria: "Weekly call/follow-up volume matches the pace required for the monthly target.",
      end_date: toISODate(endOfCurrentWeek(today)),
    });
  }
  if (!weekly) return;

  // Level 8 — Daily
  const daily = await getActive(8);
  if (!daily) {
    await create(8, weekly.id, {
      title: `Today — ${todayStr}`,
      description: "Complete today's non-negotiable outcomes and keep the task pipeline moving.",
      end_date: todayStr,
    });
  }
}
