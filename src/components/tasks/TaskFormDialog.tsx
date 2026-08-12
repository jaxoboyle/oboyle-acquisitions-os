import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { useLeads } from "@/hooks/useLeads";
import { TASK_TYPES, type TaskInput, type TaskWithLead } from "@/lib/types";
import { toastError } from "@/lib/toast";
import { todayIso } from "@/lib/utils";

const empty: TaskInput = {
  leadId: null,
  taskType: "follow_up",
  title: "",
  notes: null,
  dueDate: todayIso(),
};

export function TaskFormDialog({
  open,
  task,
  defaultDueDate,
  onClose,
}: {
  open: boolean;
  task: TaskWithLead | null;
  defaultDueDate?: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TaskInput>(empty);
  const { data: leads } = useLeads();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  useEffect(() => {
    if (task) {
      const { id: _id, completed: _c, completedAt: _ca, createdAt: _cr, leadSellerName: _ls, leadAddress: _la, ...rest } =
        task;
      setForm(rest);
    } else {
      setForm({ ...empty, dueDate: defaultDueDate ?? todayIso() });
    }
  }, [task, open, defaultDueDate]);

  function set<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toastError("Task title is required");
      return;
    }
    if (task) {
      await updateTask.mutateAsync({ id: task.id, input: form });
    } else {
      await createTask.mutateAsync(form);
    }
    onClose();
  }

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "Edit Task" : "Add Task"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Task"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" required className="col-span-2">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </Field>
        <Field label="Type">
          <Select value={form.taskType} onChange={(e) => set("taskType", e.target.value)}>
            {TASK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due Date" required>
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </Field>
        <Field label="Related Lead (optional)" className="col-span-2">
          <Select
            value={form.leadId ?? ""}
            onChange={(e) => set("leadId", e.target.value || null)}
          >
            <option value="">None</option>
            {leads?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.sellerName}
                {l.address ? ` — ${l.address}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
        </Field>
      </div>
    </Dialog>
  );
}
