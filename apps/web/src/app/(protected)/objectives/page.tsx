import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Target } from "lucide-react";

const LEVEL_LABEL: Record<number, string> = {
  1: "15-Year Vision",
  2: "5-Year Horizon",
  3: "3-Year Plan",
  4: "Annual Objective",
  5: "90-Day Sprint",
  6: "Monthly Objective",
  7: "Weekly Objective",
  8: "Daily Objective",
  9: "Task-Level",
};

const STATUS_VARIANT: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  not_started: "neutral",
  in_progress: "brand",
  completed: "success",
  paused: "warning",
  cancelled: "danger",
};

export default async function ObjectivesPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: objectives } = await supabase
    .from("objectives")
    .select("id, level, title, description, status, progress_pct, start_date, end_date, revenue_target, revenue_actual")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("level", { ascending: true })
    .order("created_at", { ascending: false });

  const byLevel = new Map<number, typeof objectives>();
  for (const obj of objectives ?? []) {
    if (!byLevel.has(obj.level)) byLevel.set(obj.level, []);
    byLevel.get(obj.level)!.push(obj);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Objectives"
        description="The nine-level planning hierarchy — from 15-year vision down to today's task."
      />

      {!objectives || objectives.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Target}
            title="No objectives recorded"
            description="Nothing has been set in the planning hierarchy yet. Objectives you or Big Stein create will be organized here by horizon — vision, annual, 90-day, monthly, weekly, and daily."
          />
        </div>
      ) : (
        levels.map((level) => (
          <section key={level} className="card p-5">
            <h2 className="text-sm font-serif font-semibold text-text mb-4 tracking-wide">
              {LEVEL_LABEL[level] ?? `Level ${level}`}
            </h2>
            <ul className="divide-y divide-surface-border">
              {(byLevel.get(level) ?? []).map((obj) => (
                <li key={obj.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-serif font-medium text-text">{obj.title}</h3>
                    <Badge variant={STATUS_VARIANT[obj.status] ?? "neutral"}>
                      {obj.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {obj.description && (
                    <p className="text-sm text-text-muted mb-3">{obj.description}</p>
                  )}
                  <ProgressBar value={obj.progress_pct} variant="accent" className="mb-2" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                    <span>{obj.progress_pct}% complete</span>
                    {obj.end_date && <span>Due {formatDate(obj.end_date)}</span>}
                  </div>
                  {(obj.revenue_target || obj.revenue_actual) && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-accent/20 text-xs">
                      <span className="text-text-muted">
                        Revenue target{" "}
                        <span className="font-serif text-accent font-medium">
                          {formatCurrency(obj.revenue_target)}
                        </span>
                      </span>
                      <span className="text-text-muted">
                        Actual{" "}
                        <span className="font-serif text-accent font-medium">
                          {formatCurrency(obj.revenue_actual)}
                        </span>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
