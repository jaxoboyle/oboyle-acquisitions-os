"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { cn, formatMinutes } from "@/lib/utils";
import { useWorkSession, type PickableTask, type TaskChoice } from "@/lib/store/work-session";

const OTHER = "__other__";

export function TaskPickerModal() {
  const reason = useWorkSession((s) => s.taskPickerReason);
  const tasks = useWorkSession((s) => s.pickableTasks);
  const closeTaskPicker = useWorkSession((s) => s.closeTaskPicker);
  const beginTask = useWorkSession((s) => s.beginTask);

  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!reason) return null;

  const canConfirm = selected != null && (selected !== OTHER || note.trim().length > 0);

  async function handleConfirm() {
    if (!selected || !canConfirm) return;
    setSubmitting(true);
    const choice: TaskChoice =
      selected === OTHER ? { taskId: null, unplannedNote: note.trim() } : { taskId: selected };
    await beginTask(choice);
    setSubmitting(false);
    setSelected(null);
    setNote("");
  }

  function handleClose() {
    setSelected(null);
    setNote("");
    closeTaskPicker();
  }

  return (
    <Modal
      title={reason === "clock_in" ? "What are you working on first?" : "Switch Task"}
      onClose={handleClose}
      widthClassName="max-w-lg"
      closeDisabled={submitting}
    >
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted">
            No open tasks right now — use Other / Unplanned Work below, or add a task first.
          </p>
        ) : (
          <div className="max-h-[45vh] overflow-y-auto space-y-1.5 pr-1">
            {tasks.map((t: PickableTask) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                disabled={submitting}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded border transition-colors",
                  selected === t.id ? "border-brand bg-brand-muted" : "border-surface-border hover:bg-surface-hover"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text">{t.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.is_non_negotiable && <Badge variant="brand">Non-negotiable</Badge>}
                    {t.is_revenue_producing && <Badge variant="accent">Revenue</Badge>}
                  </div>
                </div>
                {(t.estimated_minutes != null || t.actual_minutes != null) && (
                  <p className="text-[11px] text-text-subtle mt-0.5">
                    {t.estimated_minutes != null && `Est ${formatMinutes(t.estimated_minutes)}`}
                    {t.estimated_minutes != null && t.actual_minutes ? " · " : ""}
                    {t.actual_minutes ? `Logged ${formatMinutes(t.actual_minutes)}` : ""}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setSelected(OTHER)}
          disabled={submitting}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded border transition-colors",
            selected === OTHER ? "border-brand bg-brand-muted" : "border-surface-border hover:bg-surface-hover"
          )}
        >
          <span className="text-sm text-text">Other / Unplanned Work</span>
        </button>
        {selected === OTHER && (
          <input
            className="input text-sm"
            placeholder="Briefly describe what you're doing…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button className="btn-secondary text-sm" onClick={handleClose} disabled={submitting}>
            {reason === "clock_in" ? "Skip for now" : "Cancel"}
          </button>
          <button
            className={cn("btn-primary flex items-center gap-1.5 text-sm", !canConfirm && "opacity-50")}
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {reason === "clock_in" ? "Start Tracking" : "Switch"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
