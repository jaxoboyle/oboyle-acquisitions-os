import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { WatchPanel } from "@/components/watch/WatchPanel";
import { TaskTimeStats } from "@/components/tasks/TaskTimeStats";
import { formatDate, formatMinutes } from "@/lib/utils";
import { Clock, ListTree, PieChart, Flame } from "lucide-react";

export default async function TimePage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const [{ data: workdays }, { data: entries }, { data: allEntries }, { data: tasks }] = await Promise.all([
    supabase
      .from("workdays")
      .select("id, work_date, target_minutes, actual_minutes, day_score, clocked_in_at, clocked_out_at")
      .eq("user_id", user.id)
      .order("work_date", { ascending: false })
      .limit(30),

    supabase
      .from("time_entries")
      .select("id, started_at, ended_at, duration_minutes, category, is_productive, is_revenue_producing, notes")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(25),

    // Broader pull for the aggregate sections below — capped, not windowed,
    // since a single user's log stays well within this for a long time.
    supabase
      .from("time_entries")
      .select("task_id, category, duration_minutes")
      .eq("user_id", user.id)
      .not("duration_minutes", "is", null)
      .order("started_at", { ascending: false })
      .limit(2000),

    supabase
      .from("tasks")
      .select("id, title, task_type, estimated_minutes, actual_minutes, completed")
      .eq("user_id", user.id)
      .is("deleted_at", null),
  ]);

  // ── Aggregates ────────────────────────────────────────────────────────
  const byCategory = new Map<string, number>();
  let unplannedMinutes = 0;
  for (const e of allEntries ?? []) {
    const mins = e.duration_minutes ?? 0;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + mins);
    if (!e.task_id && e.category === "other") unplannedMinutes += mins;
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const tasksWithTime = (tasks ?? []).filter((t) => (t.actual_minutes ?? 0) > 0);
  const mostTimeConsuming = [...tasksWithTime].sort((a, b) => (b.actual_minutes ?? 0) - (a.actual_minutes ?? 0)).slice(0, 8);

  const estimatedTotal = tasksWithTime.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
  const actualTotal = tasksWithTime.reduce((sum, t) => sum + (t.actual_minutes ?? 0), 0);

  const completedMinutes = (tasks ?? []).filter((t) => t.completed).reduce((sum, t) => sum + (t.actual_minutes ?? 0), 0);
  const incompleteMinutes = (tasks ?? []).filter((t) => !t.completed).reduce((sum, t) => sum + (t.actual_minutes ?? 0), 0);

  const byTaskType = new Map<string, { totalMinutes: number; count: number }>();
  for (const t of tasksWithTime) {
    const type = t.task_type ?? "other";
    const entry = byTaskType.get(type) ?? { totalMinutes: 0, count: 0 };
    entry.totalMinutes += t.actual_minutes ?? 0;
    entry.count += 1;
    byTaskType.set(type, entry);
  }
  const recurringAverages = [...byTaskType.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([type, v]) => ({ type, average: Math.round(v.totalMinutes / v.count), count: v.count }))
    .sort((a, b) => b.average - a.average);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Time"
        description="Daily work sessions, per-task time, and logged time tracked against your target hours."
      />

      <section className="card p-8 flex items-center justify-center texture-grid">
        <WatchPanel size="lg" />
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-text mb-4">Work Days</h2>
        {!workdays || workdays.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No work sessions logged"
            description="Clock in from the Dashboard or Today page to start tracking your work days here."
          />
        ) : (
          <ul className="divide-y divide-surface-border">
            {workdays.map((day) => (
              <li key={day.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-sm font-medium text-text">{formatDate(day.work_date)}</span>
                  <span className="text-xs text-text-muted">
                    {formatMinutes(day.actual_minutes)} / {formatMinutes(day.target_minutes)}
                  </span>
                </div>
                <ProgressBar value={day.actual_minutes} max={day.target_minutes} variant="brand" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {tasksWithTime.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={15} className="text-accent" />
            <h2 className="text-sm font-semibold text-text">Most Time-Consuming Tasks</h2>
          </div>
          <ul className="divide-y divide-surface-border">
            {mostTimeConsuming.map((t) => (
              <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text truncate">{t.title}</span>
                  {t.completed && <Badge variant="success">Done</Badge>}
                </div>
                <TaskTimeStats estimatedMinutes={t.estimated_minutes} actualMinutes={t.actual_minutes} sessionCount={0} />
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-surface-border text-xs">
            <Stat label="Estimated (tracked tasks)" value={formatMinutes(estimatedTotal)} />
            <Stat label="Actual (tracked tasks)" value={formatMinutes(actualTotal)} />
            <Stat label="Completed task time" value={formatMinutes(completedMinutes)} />
            <Stat label="Incomplete task time" value={formatMinutes(incompleteMinutes)} />
          </div>
        </section>
      )}

      {recurringAverages.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListTree size={15} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Average Time by Task Type</h2>
          </div>
          <ul className="divide-y divide-surface-border">
            {recurringAverages.map((r) => (
              <li key={r.type} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                <span className="text-sm text-text capitalize">{r.type.replace(/_/g, " ")}</span>
                <span className="text-xs text-text-muted num">
                  avg {formatMinutes(r.average)} <span className="text-text-subtle">({r.count} tasks)</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {categoryRows.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={15} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Time by Category</h2>
          </div>
          <ul className="divide-y divide-surface-border">
            {categoryRows.map(([category, minutes]) => (
              <li key={category} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                <Badge variant={category === "break" ? "neutral" : "accent"}>{category.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-text-muted num">{formatMinutes(minutes)}</span>
              </li>
            ))}
            {unplannedMinutes > 0 && (
              <li className="py-2 flex items-center justify-between">
                <Badge variant="warning">unplanned work (untagged)</Badge>
                <span className="text-xs text-text-muted num">{formatMinutes(unplannedMinutes)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="card p-0 overflow-hidden">
        <h2 className="text-sm font-semibold text-text px-5 pt-5 pb-3">Recent Activity</h2>
        {!entries || entries.length === 0 ? (
          <div className="pb-2">
            <EmptyState
              icon={Clock}
              title="No time entries yet"
              description="Individual activity blocks — seller calls, follow-ups, deal work — will show up here as they're logged."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-text-muted">{formatDate(entry.started_at)}</td>
                    <td>
                      <Badge variant={entry.is_revenue_producing ? "accent" : "neutral"}>
                        {entry.category.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="text-text">
                      {entry.duration_minutes != null ? formatMinutes(entry.duration_minutes) : "—"}
                    </td>
                    <td className="text-text-muted">{entry.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-subtle uppercase tracking-wide text-[10px]">{label}</div>
      <div className="font-serif text-text mt-1">{value}</div>
    </div>
  );
}
