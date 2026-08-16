"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";

export type LeadRecord = {
  id: string;
  seller_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_source: string | null;
  asking_price: number | null;
  arv: number | null;
  estimated_repair_costs: number | null;
  reason_for_selling: string | null;
  property_condition: string | null;
  desired_timeline: string | null;
  conversation_notes: string | null;
  stage: string;
  priority: string;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  disposition?: string | null;
  disposition_reason?: string | null;
  disposition_notes?: string | null;
  disposed_at?: string | null;
};

const STAGES = [
  "new_lead", "attempted_contact", "contacted", "follow_up", "qualified_lead",
  "appointment_scheduled", "offer_sent", "negotiating", "under_contract",
  "finding_buyer", "sent_to_title", "closing_scheduled", "closed", "dead_lead",
];

function humanize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeadFormDialog({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!lead;
  const [form, setForm] = useState({
    seller_name: lead?.seller_name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    address: lead?.address ?? "",
    city: lead?.city ?? "",
    state: lead?.state ?? "",
    zip: lead?.zip ?? "",
    lead_source: lead?.lead_source ?? "",
    asking_price: lead?.asking_price?.toString() ?? "",
    arv: lead?.arv?.toString() ?? "",
    estimated_repair_costs: lead?.estimated_repair_costs?.toString() ?? "",
    reason_for_selling: lead?.reason_for_selling ?? "",
    property_condition: lead?.property_condition ?? "",
    desired_timeline: lead?.desired_timeline ?? "",
    conversation_notes: lead?.conversation_notes ?? "",
    stage: lead?.stage ?? "new_lead",
    priority: lead?.priority ?? "medium",
    last_contact_date: lead?.last_contact_date ?? "",
    next_follow_up_date: lead?.next_follow_up_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.seller_name.trim()) {
      setError("Owner/seller name is required.");
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
      seller_name: form.seller_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      lead_source: form.lead_source || null,
      asking_price: form.asking_price ? Number(form.asking_price) : null,
      arv: form.arv ? Number(form.arv) : null,
      estimated_repair_costs: form.estimated_repair_costs ? Number(form.estimated_repair_costs) : null,
      reason_for_selling: form.reason_for_selling || null,
      property_condition: form.property_condition || null,
      desired_timeline: form.desired_timeline || null,
      conversation_notes: form.conversation_notes || null,
      stage: form.stage,
      priority: form.priority,
      last_contact_date: form.last_contact_date || null,
      next_follow_up_date: form.next_follow_up_date || null,
    };

    const { error: dbError } = isEdit
      ? await supabase.from("leads").update(payload).eq("id", lead!.id)
      : await supabase.from("leads").insert({ ...payload, user_id: user.id });

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
      title={isEdit ? "Edit Lead" : "Add Lead"}
      onClose={onClose}
      widthClassName="max-w-2xl"
      closeDisabled={saving}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Owner / Seller Name *" value={form.seller_name} onChange={(v) => set("seller_name", v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Lead Source" value={form.lead_source} onChange={(v) => set("lead_source", v)} placeholder="Direct mail, cold call, referral…" />
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Property Address" value={form.address} onChange={(v) => set("address", v)} className="sm:col-span-2" />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
            <Field label="Zip" value={form.zip} onChange={(v) => set("zip", v)} />
          </div>
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Asking Price" type="number" value={form.asking_price} onChange={(v) => set("asking_price", v)} />
          <Field label="Estimated ARV" type="number" value={form.arv} onChange={(v) => set("arv", v)} />
          <Field label="Estimated Repairs" type="number" value={form.estimated_repair_costs} onChange={(v) => set("estimated_repair_costs", v)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Motivation / Reason for Selling" value={form.reason_for_selling} onChange={(v) => set("reason_for_selling", v)} />
          <Field label="Property Condition" value={form.property_condition} onChange={(v) => set("property_condition", v)} />
          <Field label="Timeline" value={form.desired_timeline} onChange={(v) => set("desired_timeline", v)} />
          <div>
            <label className="text-xs text-text-muted block mb-1">Priority</label>
            <select className="input text-sm" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Status</label>
            <select className="input text-sm" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>{humanize(s)}</option>
              ))}
            </select>
          </div>
          <Field label="Last Contacted" type="date" value={form.last_contact_date} onChange={(v) => set("last_contact_date", v)} />
          <Field label="Next Follow-Up" type="date" value={form.next_follow_up_date} onChange={(v) => set("next_follow_up_date", v)} />
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">Seller Situation / Notes</label>
          <textarea
            className="input text-sm min-h-[80px]"
            value={form.conversation_notes}
            onChange={(e) => set("conversation_notes", e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Add Lead"}
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
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        type={type}
        className="input text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
