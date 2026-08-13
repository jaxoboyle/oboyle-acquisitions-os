"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";

export type ObjectiveRecord = {
  id: string;
  parent_id: string | null;
  level: number;
  title: string;
  description: string | null;
  why_it_matters: string | null;
  success_criteria: string | null;
  status: string;
  progress_pct: number;
  start_date: string | null;
  end_date: string | null;
  revenue_target: number | null;
  revenue_actual: number | null;
  big_stein_evaluation: string | null;
};

export type ObjectiveParentOption = { id: string; level: number; title: string };

const LEVEL_OPTIONS = [
  { value: 1, label: "15-Year Vision" },
  { value: 4, label: "Annual Objective" },
  { value: 5, label: "90-Day Objective" },
  { value: 6, label: "Monthly Objective" },
  { value: 7, label: "Weekly Objective" },
  { value: 8, label: "Daily Objective" },
];

export function ObjectiveFormDialog({
  objective,
  parentOptions,
  onClose,
  onSaved,
}: {
  objective: ObjectiveRecord | null;
  parentOptions: ObjectiveParentOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!objective;
  const [form, setForm] = useState({
    level: objective?.level ?? 8,
    parent_id: objective?.parent_id ?? "",
    title: objective?.title ?? "",
    description: objective?.description ?? "",
    why_it_matters: objective?.why_it_matters ?? "",
    success_criteria: objective?.success_criteria ?? "",
    status: objective?.status ?? "in_progress",
    progress_pct: objective?.progress_pct?.toString() ?? "0",
    start_date: objective?.start_date ?? "",
    end_date: objective?.end_date ?? "",
    revenue_target: objective?.revenue_target?.toString() ?? "",
    revenue_actual: objective?.revenue_actual?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const payload = {
      level: form.level,
      parent_id: form.parent_id || null,
      title: form.title.trim(),
      description: form.description || null,
      why_it_matters: form.why_it_matters || null,
      success_criteria: form.success_criteria || null,
      status: form.status,
      progress_pct: form.progress_pct ? Number(form.progress_pct) : 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      revenue_target: form.revenue_target ? Number(form.revenue_target) : null,
      revenue_actual: form.revenue_actual ? Number(form.revenue_actual) : null,
    };

    const { error: dbError } = isEdit
      ? await supabase.from("objectives").update(payload).eq("id", objective!.id)
      : await supabase.from("objectives").insert({ ...payload, user_id: user.id });

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onSaved();
    router.refresh();
  }

  return (
    <Modal
      title={isEdit ? "Edit Objective" : "Add Objective"}
      onClose={onClose}
      widthClassName="max-w-2xl"
      closeDisabled={saving}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Level</label>
            <select
              className="input text-sm"
              value={form.level}
              onChange={(e) => set("level", Number(e.target.value))}
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Parent Objective</label>
            <select className="input text-sm" value={form.parent_id} onChange={(e) => set("parent_id", e.target.value)}>
              <option value="">— None —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        <Field label="Title *" value={form.title} onChange={(v) => set("title", v)} />
        <div>
          <label className="text-xs text-text-muted block mb-1">Description</label>
          <textarea className="input text-sm min-h-[60px]" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Success Criteria</label>
          <textarea className="input text-sm min-h-[50px]" value={form.success_criteria} onChange={(e) => set("success_criteria", e.target.value)} />
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Start Date" type="date" value={form.start_date} onChange={(v) => set("start_date", v)} />
          <Field label="End Date" type="date" value={form.end_date} onChange={(v) => set("end_date", v)} />
          <Field label="Revenue Target" type="number" value={form.revenue_target} onChange={(v) => set("revenue_target", v)} />
          <Field label="Revenue Actual" type="number" value={form.revenue_actual} onChange={(v) => set("revenue_actual", v)} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Status</label>
            <select className="input text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <Field label="Progress %" type="number" value={form.progress_pct} onChange={(v) => set("progress_pct", v)} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Add Objective"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input type={type} className="input text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
