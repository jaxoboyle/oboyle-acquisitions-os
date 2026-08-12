import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  Calendar as CalendarIcon,
  Trash2,
  Pencil,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useDeleteTask, useSetTaskCompleted, useTasks } from "@/hooks/useTasks";
import type { TaskWithLead } from "@/lib/types";
import { TASK_TYPES } from "@/lib/types";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { cn, formatDate, isPastDue, todayIso } from "@/lib/utils";

function TaskRow({
  task,
  onEdit,
  onDelete,
}: {
  task: TaskWithLead;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const setCompleted = useSetTaskCompleted();
  const overdue = !task.completed && isPastDue(task.dueDate);

  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      <button
        onClick={() => setCompleted.mutate({ id: task.id, completed: !task.completed })}
        className={cn("shrink-0", task.completed ? "text-success" : "text-text-muted hover:text-accent")}
      >
        {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[13px] font-medium", task.completed ? "text-text-muted line-through" : "text-text")}>
          {task.title}
        </div>
        <div className="truncate text-[12px] text-text-muted">
          {TASK_TYPES.find((t) => t.id === task.taskType)?.label ?? task.taskType}
          {task.leadSellerName ? ` · ${task.leadSellerName}` : ""}
        </div>
      </div>
      <div className={cn("shrink-0 text-[12.5px] font-medium", overdue ? "text-danger" : "text-text-muted")}>
        {formatDate(task.dueDate)}
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={onEdit} className="rounded p-1.5 text-text-muted hover:bg-surface-hover hover:text-text">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="rounded p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function Tasks() {
  const { data: tasks, isLoading } = useTasks();
  const deleteTask = useDeleteTask();

  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithLead | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskWithLead | null>(null);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (typeFilter && t.taskType !== typeFilter) return false;
      if (!showCompleted && t.completed) return false;
      if (q && !`${t.title} ${t.leadSellerName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, typeFilter, showCompleted]);

  const today = todayIso();
  const overdue = filtered.filter((t) => !t.completed && t.dueDate < today);
  const dueToday = filtered.filter((t) => !t.completed && t.dueDate === today);
  const upcoming = filtered.filter((t) => !t.completed && t.dueDate > today);
  const completed = filtered.filter((t) => t.completed);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithLead[]>();
    for (const t of filtered) {
      const key = t.dueDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Tasks & Calendar</h1>
          <p className="text-sm text-text-muted">Follow-ups, deadlines, and appointments in one place.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
        >
          <Plus size={15} /> Add Task
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-52">
          <option value="">All Types</option>
          {TASK_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-[13px] text-text-muted">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed
        </label>

        <div className="ml-auto flex gap-1 rounded-md border border-border p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-[12.5px] font-medium",
              view === "list" ? "bg-accent-soft text-accent" : "text-text-muted",
            )}
          >
            <ListIcon size={13} /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-[12.5px] font-medium",
              view === "calendar" ? "bg-accent-soft text-accent" : "text-text-muted",
            )}
          >
            <CalendarIcon size={13} /> Calendar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : view === "list" ? (
        filtered.length === 0 ? (
          <EmptyState icon={ListIcon} title="No tasks" description="Add a task to get started." />
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-1 text-[12.5px] font-semibold text-danger">
                  Overdue ({overdue.length})
                </h3>
                {overdue.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onEdit={() => {
                      setEditingTask(t);
                      setFormOpen(true);
                    }}
                    onDelete={() => setPendingDelete(t)}
                  />
                ))}
              </Card>
            )}
            {dueToday.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-1 text-[12.5px] font-semibold text-warning">
                  Due Today ({dueToday.length})
                </h3>
                {dueToday.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onEdit={() => {
                      setEditingTask(t);
                      setFormOpen(true);
                    }}
                    onDelete={() => setPendingDelete(t)}
                  />
                ))}
              </Card>
            )}
            {upcoming.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-1 text-[12.5px] font-semibold text-text-muted">
                  Upcoming ({upcoming.length})
                </h3>
                {upcoming.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onEdit={() => {
                      setEditingTask(t);
                      setFormOpen(true);
                    }}
                    onDelete={() => setPendingDelete(t)}
                  />
                ))}
              </Card>
            )}
            {showCompleted && completed.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-1 text-[12.5px] font-semibold text-text-muted">
                  Completed ({completed.length})
                </h3>
                {completed.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onEdit={() => {
                      setEditingTask(t);
                      setFormOpen(true);
                    }}
                    onDelete={() => setPendingDelete(t)}
                  />
                ))}
              </Card>
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setMonth((m) => subMonths(m, 1))} className="rounded p-1 hover:bg-surface-hover">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-text">{format(month, "MMMM yyyy")}</span>
              <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded p-1 hover:bg-surface-hover">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-text-muted">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDay.get(key) ?? [];
                const hasOverdue = dayTasks.some((t) => !t.completed && key < today);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={cn(
                      "flex h-16 flex-col items-start rounded-md border p-1.5 text-left",
                      isSameMonth(day, month) ? "border-border" : "border-transparent opacity-40",
                      isToday(day) && "border-accent",
                      selectedDay === key && "bg-accent-soft",
                    )}
                  >
                    <span className="text-[11.5px] font-medium text-text">{format(day, "d")}</span>
                    {dayTasks.length > 0 && (
                      <span
                        className={cn(
                          "mt-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          hasOverdue ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent",
                        )}
                      >
                        {dayTasks.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 text-[12.5px] font-semibold text-text-muted">
              {selectedDay ? formatDate(selectedDay) : "Select a day"}
            </h3>
            {!selectedDay || (tasksByDay.get(selectedDay) ?? []).length === 0 ? (
              <p className="text-[12.5px] text-text-muted">No tasks on this day.</p>
            ) : (
              (tasksByDay.get(selectedDay) ?? []).map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onEdit={() => {
                    setEditingTask(t);
                    setFormOpen(true);
                  }}
                  onDelete={() => setPendingDelete(t)}
                />
              ))
            )}
          </Card>
        </div>
      )}

      <TaskFormDialog
        open={formOpen}
        task={editingTask}
        defaultDueDate={selectedDay ?? undefined}
        onClose={() => setFormOpen(false)}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this task?"
        description={`"${pendingDelete?.title}" will be permanently removed.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteTask.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
