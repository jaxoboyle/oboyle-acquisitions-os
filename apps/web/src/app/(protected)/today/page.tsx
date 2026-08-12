import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { WatchPanel } from "@/components/watch/WatchPanel";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { formatMinutes, todayISO } from "@/lib/utils";
import { CalendarDays, Target } from "lucide-react";

export default async function TodayPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const today = todayISO();

  const [{ data: nonNegotiables }, { data: dueToday }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, notes, task_type, category, status, completed, priority, is_revenue_producing, estimated_minutes, scheduled_start")
      .eq("user_id", user.id)
      .eq("is_non_negotiable", true)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true, nullsFirst: false }),

    supabase
      .from("tasks")
      .select("id, title, notes, task_type, category, status, completed, priority, is_revenue_producing, due_date")
      .eq("user_id", user.id)
      .gte("due_date", `${today}T00:00:00.000Z`)
      .lte("due_date", `${today}T23:59:59.999Z`)
      .is("deleted_at", null)
      .order("due_date", { ascending: true }),
  ]);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader title="Today" description={dateLabel} />

      <div className="card p-5 flex items-center justify-center">
        <WatchPanel size="sm" />
      </div>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-brand" />
          <h2 className="text-sm font-semibold text-text">Non-Negotiables</h2>
        </div>
        {!nonNegotiables || nonNegotiables.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No non-negotiables set"
            description="Mark a task as non-negotiable from the Tasks page and it will hold a permanent place here until it's done."
            action={{ label: "Go to Tasks", href: "/tasks" }}
          />
        ) : (
          <ul className="space-y-3">
            {nonNegotiables.map((task) => (
              <li key={task.id} className="flex items-start gap-3">
                <TaskCheckbox task={task} />
                <div className="min-w-0 flex-1">
                  <p className={task.completed ? "text-sm text-text-muted line-through" : "text-sm text-text"}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {task.estimated_minutes != null && (
                      <span className="text-[11px] text-text-subtle">
                        {formatMinutes(task.estimated_minutes)}
                      </span>
                    )}
                    {task.is_revenue_producing && <Badge variant="accent">Revenue</Badge>}
                    {(task.priority === "critical" || task.priority === "high") && (
                      <Badge variant="danger">{task.priority}</Badge>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={16} className="text-brand" />
          <h2 className="text-sm font-semibold text-text">Due Today</h2>
        </div>
        {!dueToday || dueToday.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">Nothing due today.</p>
        ) : (
          <ul className="space-y-3">
            {dueToday.map((task) => (
              <li key={task.id} className="flex items-start gap-3">
                <TaskCheckbox task={task} />
                <p className={task.completed ? "text-sm text-text-muted line-through" : "text-sm text-text"}>
                  {task.title}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
