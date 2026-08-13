"use client";

import { useState } from "react";
import { Plus, Pencil, Target, Archive } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ObjectiveFormDialog,
  type ObjectiveRecord,
  type ObjectiveParentOption,
} from "@/components/objectives/ObjectiveFormDialog";

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

const ACTIVE_STATUSES = new Set(["not_started", "in_progress", "paused"]);

export function ObjectivesClient({ objectives }: { objectives: ObjectiveRecord[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ObjectiveRecord | null>(null);

  const parentOptions: ObjectiveParentOption[] = objectives
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .map((o) => ({ id: o.id, level: o.level, title: o.title }));

  const byLevel = new Map<number, ObjectiveRecord[]>();
  for (const obj of objectives) {
    if (!byLevel.has(obj.level)) byLevel.set(obj.level, []);
    byLevel.get(obj.level)!.push(obj);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(objective: ObjectiveRecord) {
    setEditing(objective);
    setDialogOpen(true);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Objectives"
        description="The planning hierarchy — from the 15-year vision down to today's objective. Tasks flow downward from here."
        action={
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Add Objective
          </button>
        }
      />

      {objectives.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Target}
            title="No objectives recorded"
            description="Nothing has been set in the planning hierarchy yet."
          />
        </div>
      ) : (
        levels.map((level) => {
          const all = byLevel.get(level) ?? [];
          const active = all.filter((o) => ACTIVE_STATUSES.has(o.status));
          const archived = all.filter((o) => !ACTIVE_STATUSES.has(o.status));

          return (
            <section key={level} className="card p-5">
              <h2 className="text-sm font-serif font-semibold text-text mb-4 tracking-wide">
                {LEVEL_LABEL[level] ?? `Level ${level}`}
              </h2>

              {active.length > 0 && (
                <ul className="divide-y divide-surface-border">
                  {active.map((obj) => (
                    <ObjectiveRow key={obj.id} objective={obj} onEdit={openEdit} />
                  ))}
                </ul>
              )}

              {archived.length > 0 && (
                <details className="mt-4 group">
                  <summary className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-text cursor-pointer select-none">
                    <Archive size={12} />
                    Archived ({archived.length})
                  </summary>
                  <ul className="divide-y divide-surface-border mt-2">
                    {archived.map((obj) => (
                      <ObjectiveRow key={obj.id} objective={obj} onEdit={openEdit} archived />
                    ))}
                  </ul>
                </details>
              )}
            </section>
          );
        })
      )}

      {dialogOpen && (
        <ObjectiveFormDialog
          objective={editing}
          parentOptions={parentOptions}
          onClose={() => setDialogOpen(false)}
          onSaved={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

function ObjectiveRow({
  objective: obj,
  onEdit,
  archived,
}: {
  objective: ObjectiveRecord;
  onEdit: (o: ObjectiveRecord) => void;
  archived?: boolean;
}) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-serif font-medium text-text">{obj.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={STATUS_VARIANT[obj.status] ?? "neutral"}>{obj.status.replace("_", " ")}</Badge>
          <button onClick={() => onEdit(obj)} className="text-text-subtle hover:text-brand transition-colors" aria-label="Edit objective">
            <Pencil size={13} />
          </button>
        </div>
      </div>
      {obj.description && <p className="text-sm text-text-muted mb-3">{obj.description}</p>}
      {!archived && <ProgressBar value={obj.progress_pct} variant="accent" className="mb-2" />}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>{obj.progress_pct}% complete</span>
        {obj.end_date && <span>{archived ? "Ended" : "Due"} {formatDate(obj.end_date)}</span>}
      </div>
      {(obj.revenue_target || obj.revenue_actual) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-accent/20 text-xs">
          <span className="text-text-muted">
            Revenue target <span className="font-serif text-accent font-medium">{formatCurrency(obj.revenue_target)}</span>
          </span>
          <span className="text-text-muted">
            Actual <span className="font-serif text-accent font-medium">{formatCurrency(obj.revenue_actual)}</span>
          </span>
        </div>
      )}
      {archived && obj.big_stein_evaluation && (
        <div className="mt-3 pt-3 border-t border-surface-border text-xs">
          <span className="label-tech">Big Stein&apos;s Review</span>
          <p className="text-text-muted mt-1">{obj.big_stein_evaluation}</p>
        </div>
      )}
    </li>
  );
}
