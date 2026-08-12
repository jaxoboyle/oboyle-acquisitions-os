import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { WatchPanel } from "@/components/watch/WatchPanel";
import { formatDate, formatMinutes } from "@/lib/utils";
import { Clock } from "lucide-react";

export default async function TimePage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const [{ data: workdays }, { data: entries }] = await Promise.all([
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
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Time"
        description="Daily work sessions and logged time, tracked against your target hours."
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
                <ProgressBar
                  value={day.actual_minutes}
                  max={day.target_minutes}
                  variant="brand"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

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
