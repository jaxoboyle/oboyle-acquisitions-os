import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  // Load parallel data
  const [
    { data: settings },
    { data: revenueTarget },
    { data: todayWorkday },
    { data: overdueTasks },
    { data: todayTasks },
    { data: activeDeals },
    { data: currentObjective },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("company_settings")
      .select("company_name, thirty_day_revenue_target")
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
      .from("revenue_targets")
      .select("target_main, collected, closed_awaiting_collection, contracted_awaiting_closing, projected_pipeline, period_end")
      .eq("user_id", user.id)
      .eq("period_type", "thirty_day")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("workdays")
      .select("id, work_date, clocked_in_at, clocked_out_at, target_minutes, actual_minutes")
      .eq("user_id", user.id)
      .eq("work_date", new Date().toISOString().split("T")[0])
      .maybeSingle(),

    supabase
      .from("tasks")
      .select("id, title, due_date, status, priority, is_revenue_producing")
      .eq("user_id", user.id)
      .in("status", ["not_started", "in_progress", "paused", "blocked"])
      .lt("due_date", new Date().toISOString())
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(5),

    supabase
      .from("tasks")
      .select("id, title, status, is_non_negotiable, scheduled_start, estimated_minutes, is_revenue_producing")
      .eq("user_id", user.id)
      .eq("is_non_negotiable", true)
      .is("deleted_at", null)
      .order("scheduled_start", { ascending: true })
      .limit(3),

    supabase
      .from("deals")
      .select("id, assignment_fee, closing_status, closing_date, lead_id")
      .eq("user_id", user.id)
      .not("closing_status", "eq", "closed")
      .not("closing_status", "eq", "fell_through")
      .is("deleted_at", null)
      .limit(5),

    supabase
      .from("objectives")
      .select("id, title, progress_pct, end_date, level, status")
      .eq("user_id", user.id)
      .eq("level", 6)
      .eq("status", "in_progress")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("activity_log")
      .select("id, activity_type, description, created_at, leads(seller_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning."
      : hour < 17
      ? "Good afternoon."
      : "Good evening.";

  return (
    <DashboardClient
      greeting={greeting}
      settings={settings}
      revenueTarget={revenueTarget}
      todayWorkday={todayWorkday}
      overdueTasks={overdueTasks ?? []}
      todayTasks={todayTasks ?? []}
      activeDeals={activeDeals ?? []}
      currentObjective={currentObjective}
      recentActivity={recentActivity ?? []}
    />
  );
}
