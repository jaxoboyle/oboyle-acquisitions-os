import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { formatDate } from "@/lib/utils";
import { CheckSquare } from "lucide-react";

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "neutral",
};

export default async function TasksPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, notes, task_type, status, completed, priority, category, is_revenue_producing, is_non_negotiable, due_date")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("completed", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  const open = (tasks ?? []).filter((t) => !t.completed);
  const completed = (tasks ?? []).filter((t) => t.completed);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader title="Tasks" description="Every open and completed outcome tracked in the operating system." />

      {!tasks || tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Tasks created by you or by Big Stein will show up here — nothing has been logged yet."
          />
        </div>
      ) : (
        <>
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-4">
              Open <span className="text-text-subtle font-normal">({open.length})</span>
            </h2>
            {open.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">Nothing open. Clean slate.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {open.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <TaskCheckbox task={task} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {task.due_date && (
                          <span className="text-[11px] text-text-subtle">{formatDate(task.due_date)}</span>
                        )}
                        {task.category && <Badge variant="neutral">{task.category}</Badge>}
                        {task.priority && task.priority !== "medium" && (
                          <Badge variant={PRIORITY_VARIANT[task.priority] ?? "neutral"}>{task.priority}</Badge>
                        )}
                        {task.is_non_negotiable && <Badge variant="brand">Non-negotiable</Badge>}
                        {task.is_revenue_producing && <Badge variant="accent">Revenue</Badge>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {completed.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-4">
                Completed <span className="text-text-subtle font-normal">({completed.length})</span>
              </h2>
              <ul className="divide-y divide-surface-border">
                {completed.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <TaskCheckbox task={task} />
                    <p className="text-sm text-text-muted line-through">{task.title}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
