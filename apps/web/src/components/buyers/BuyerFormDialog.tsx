"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";

export type BuyerRecord = {
  id: string;
  buyer_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  areas: string | null;
  property_types: string | null;
  max_purchase_price: number | null;
  max_repair_level: string | null;
  funding_type: string;
  proof_of_funds_status: string | null;
  typical_closing_speed: string | null;
  preferred_title_company: string | null;
  notes: string | null;
  status: string;
  last_contact_date: string | null;
};

export function BuyerFormDialog({
  buyer,
  onClose,
  onSaved,
}: {
  buyer: BuyerRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!buyer;
  const [form, setForm] = useState({
    buyer_name: buyer?.buyer_name ?? "",
    company_name: buyer?.company_name ?? "",
    phone: buyer?.phone ?? "",
    email: buyer?.email ?? "",
    areas: buyer?.areas ?? "",
    property_types: buyer?.property_types ?? "",
    max_purchase_price: buyer?.max_purchase_price?.toString() ?? "",
    max_repair_level: buyer?.max_repair_level ?? "",
    funding_type: buyer?.funding_type ?? "cash",
    proof_of_funds_status: buyer?.proof_of_funds_status ?? "",
    typical_closing_speed: buyer?.typical_closing_speed ?? "",
    preferred_title_company: buyer?.preferred_title_company ?? "",
    notes: buyer?.notes ?? "",
    status: buyer?.status ?? "active",
    last_contact_date: buyer?.last_contact_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.buyer_name.trim()) {
      setError("Buyer/company name is required.");
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
      buyer_name: form.buyer_name.trim(),
      company_name: form.company_name || null,
      phone: form.phone || null,
      email: form.email || null,
      areas: form.areas || null,
      property_types: form.property_types || null,
      max_purchase_price: form.max_purchase_price ? Number(form.max_purchase_price) : null,
      max_repair_level: form.max_repair_level || null,
      funding_type: form.funding_type,
      proof_of_funds_status: form.proof_of_funds_status || null,
      typical_closing_speed: form.typical_closing_speed || null,
      preferred_title_company: form.preferred_title_company || null,
      notes: form.notes || null,
      status: form.status,
      last_contact_date: form.last_contact_date || null,
    };

    const { error: dbError } = isEdit
      ? await supabase.from("buyers").update(payload).eq("id", buyer!.id)
      : await supabase.from("buyers").insert({ ...payload, user_id: user.id });

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
      title={isEdit ? "Edit Buyer" : "Add Buyer"}
      onClose={onClose}
      widthClassName="max-w-2xl"
      closeDisabled={saving}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Buyer / Company Name *" value={form.buyer_name} onChange={(v) => set("buyer_name", v)} />
          <Field label="Company Name" value={form.company_name} onChange={(v) => set("company_name", v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Areas They Buy" value={form.areas} onChange={(v) => set("areas", v)} placeholder="Zip codes, neighborhoods…" />
          <Field label="Property Types" value={form.property_types} onChange={(v) => set("property_types", v)} placeholder="SFR, multifamily, land…" />
          <Field label="Price Range (max)" type="number" value={form.max_purchase_price} onChange={(v) => set("max_purchase_price", v)} />
          <Field label="Rehab Level" value={form.max_repair_level} onChange={(v) => set("max_repair_level", v)} placeholder="Light, moderate, full gut…" />
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Cash / Financing</label>
            <select className="input text-sm" value={form.funding_type} onChange={(e) => set("funding_type", e.target.value)}>
              <option value="cash">Cash</option>
              <option value="financing">Financing</option>
              <option value="both">Both</option>
            </select>
          </div>
          <Field label="Proof of Funds Status" value={form.proof_of_funds_status} onChange={(v) => set("proof_of_funds_status", v)} />
          <Field label="Typical Closing Speed" value={form.typical_closing_speed} onChange={(v) => set("typical_closing_speed", v)} placeholder="7 days, 14 days…" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Preferred Title Company" value={form.preferred_title_company} onChange={(v) => set("preferred_title_company", v)} className="sm:col-span-2" />
          <div>
            <label className="text-xs text-text-muted block mb-1">Status</label>
            <select className="input text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="do_not_contact">Do Not Contact</option>
            </select>
          </div>
        </div>

        <Field label="Last Contacted" type="date" value={form.last_contact_date} onChange={(v) => set("last_contact_date", v)} className="max-w-[200px]" />

        <div>
          <label className="text-xs text-text-muted block mb-1">Notes</label>
          <textarea
            className="input text-sm min-h-[80px]"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Add Buyer"}
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
