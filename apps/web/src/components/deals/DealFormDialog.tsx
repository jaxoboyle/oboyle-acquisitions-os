"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";

export type DealLeadOption = {
  id: string;
  seller_name: string;
  address: string | null;
  asking_price: number | null;
  arv: number | null;
  estimated_repair_costs: number | null;
  mao: number | null;
};

export type DealBuyerOption = { id: string; buyer_name: string };

export type DealRecord = {
  id: string;
  lead_id: string;
  contract_date: string | null;
  earnest_money_amount: number | null;
  earnest_money_due_date: string | null;
  inspection_period_end_date: string | null;
  closing_date: string | null;
  title_company_name: string | null;
  title_company_phone: string | null;
  title_company_email: string | null;
  end_buyer_id: string | null;
  end_buyer_name: string | null;
  buyer_deposit: number | null;
  assignment_fee: number | null;
  title_status: string;
  closing_status: string;
  deal_stage: string;
  deal_notes: string | null;
};

const DEAL_STAGES = ["analyzing", "negotiating", "under_contract", "finding_buyer", "assigned", "closing", "closed", "dead"];
const TITLE_STATUSES = ["not_started", "search_in_progress", "clear", "issue_found", "resolved"];
const CLOSING_STATUSES = ["pending", "scheduled", "delayed", "closed", "fell_through"];

function humanize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DealFormDialog({
  deal,
  availableLeads,
  buyers,
  onClose,
  onSaved,
}: {
  deal: DealRecord | null;
  availableLeads: DealLeadOption[];
  buyers: DealBuyerOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!deal;
  const [form, setForm] = useState({
    lead_id: deal?.lead_id ?? "",
    contract_date: deal?.contract_date ?? "",
    earnest_money_amount: deal?.earnest_money_amount?.toString() ?? "",
    earnest_money_due_date: deal?.earnest_money_due_date ?? "",
    inspection_period_end_date: deal?.inspection_period_end_date ?? "",
    closing_date: deal?.closing_date ?? "",
    title_company_name: deal?.title_company_name ?? "",
    title_company_phone: deal?.title_company_phone ?? "",
    title_company_email: deal?.title_company_email ?? "",
    end_buyer_id: deal?.end_buyer_id ?? "",
    end_buyer_name: deal?.end_buyer_name ?? "",
    buyer_deposit: deal?.buyer_deposit?.toString() ?? "",
    assignment_fee: deal?.assignment_fee?.toString() ?? "",
    title_status: deal?.title_status ?? "not_started",
    closing_status: deal?.closing_status ?? "pending",
    deal_stage: deal?.deal_stage ?? "analyzing",
    deal_notes: deal?.deal_notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const selectedLead = useMemo(
    () => availableLeads.find((l) => l.id === form.lead_id) ?? null,
    [availableLeads, form.lead_id]
  );

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectBuyer(buyerId: string) {
    const buyer = buyers.find((b) => b.id === buyerId);
    setForm((f) => ({ ...f, end_buyer_id: buyerId, end_buyer_name: buyer?.buyer_name ?? f.end_buyer_name }));
  }

  async function handleSave() {
    if (!form.lead_id) {
      setError("Select the lead this deal is connected to.");
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
      lead_id: form.lead_id,
      contract_date: form.contract_date || null,
      earnest_money_amount: form.earnest_money_amount ? Number(form.earnest_money_amount) : null,
      earnest_money_due_date: form.earnest_money_due_date || null,
      inspection_period_end_date: form.inspection_period_end_date || null,
      closing_date: form.closing_date || null,
      title_company_name: form.title_company_name || null,
      title_company_phone: form.title_company_phone || null,
      title_company_email: form.title_company_email || null,
      end_buyer_id: form.end_buyer_id || null,
      end_buyer_name: form.end_buyer_name || null,
      buyer_deposit: form.buyer_deposit ? Number(form.buyer_deposit) : null,
      assignment_fee: form.assignment_fee ? Number(form.assignment_fee) : null,
      title_status: form.title_status,
      closing_status: form.closing_status,
      deal_stage: form.deal_stage,
      deal_notes: form.deal_notes || null,
    };

    const { error: dbError } = isEdit
      ? await supabase.from("deals").update(payload).eq("id", deal!.id)
      : await supabase.from("deals").insert({ ...payload, user_id: user.id });

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
      title={isEdit ? "Edit Deal" : "Add Deal"}
      onClose={onClose}
      widthClassName="max-w-2xl"
      closeDisabled={saving}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-muted block mb-1">Lead *</label>
          <select
            className="input text-sm"
            value={form.lead_id}
            onChange={(e) => set("lead_id", e.target.value)}
            disabled={isEdit}
          >
            <option value="">Select a lead…</option>
            {selectedLead && !availableLeads.some((l) => l.id === selectedLead.id) && (
              <option value={selectedLead.id}>{selectedLead.seller_name}</option>
            )}
            {availableLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.seller_name}{l.address ? ` — ${l.address}` : ""}
              </option>
            ))}
          </select>
          {isEdit && <p className="text-[11px] text-text-subtle mt-1">The linked lead can&apos;t be changed after a deal is created.</p>}
        </div>

        {selectedLead && (
          <div className="rounded border border-surface-border bg-bg-muted p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <ReadOnlyStat label="Asking" value={formatCurrency(selectedLead.asking_price)} />
            <ReadOnlyStat label="ARV" value={formatCurrency(selectedLead.arv)} />
            <ReadOnlyStat label="Repairs" value={formatCurrency(selectedLead.estimated_repair_costs)} />
            <ReadOnlyStat label="MAO" value={formatCurrency(selectedLead.mao)} />
          </div>
        )}

        <div className="divider-brass" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Deal Stage</label>
            <select className="input text-sm" value={form.deal_stage} onChange={(e) => set("deal_stage", e.target.value)}>
              {DEAL_STAGES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Title Status</label>
            <select className="input text-sm" value={form.title_status} onChange={(e) => set("title_status", e.target.value)}>
              {TITLE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Closing Status</label>
            <select className="input text-sm" value={form.closing_status} onChange={(e) => set("closing_status", e.target.value)}>
              {CLOSING_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
          <Field label="Assignment Fee" type="number" value={form.assignment_fee} onChange={(v) => set("assignment_fee", v)} />
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Buyer (from your list)</label>
            <select className="input text-sm" value={form.end_buyer_id} onChange={(e) => selectBuyer(e.target.value)}>
              <option value="">— Not selected —</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>{b.buyer_name}</option>
              ))}
            </select>
          </div>
          <Field label="Buyer Name (if not in list)" value={form.end_buyer_name} onChange={(v) => set("end_buyer_name", v)} />
          <Field label="EMD" type="number" value={form.earnest_money_amount} onChange={(v) => set("earnest_money_amount", v)} />
          <Field label="Buyer Deposit" type="number" value={form.buyer_deposit} onChange={(v) => set("buyer_deposit", v)} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Contract Date" type="date" value={form.contract_date} onChange={(v) => set("contract_date", v)} />
          <Field label="EMD Due Date" type="date" value={form.earnest_money_due_date} onChange={(v) => set("earnest_money_due_date", v)} />
          <Field label="Inspection End" type="date" value={form.inspection_period_end_date} onChange={(v) => set("inspection_period_end_date", v)} />
          <Field label="Closing Date" type="date" value={form.closing_date} onChange={(v) => set("closing_date", v)} />
        </div>

        <div className="divider-brass" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Title Company" value={form.title_company_name} onChange={(v) => set("title_company_name", v)} />
          <Field label="Title Co. Phone" value={form.title_company_phone} onChange={(v) => set("title_company_phone", v)} />
          <Field label="Title Co. Email" type="email" value={form.title_company_email} onChange={(v) => set("title_company_email", v)} />
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">Notes</label>
          <textarea
            className="input text-sm min-h-[70px]"
            value={form.deal_notes}
            onChange={(e) => set("deal_notes", e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Add Deal"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReadOnlyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-subtle uppercase tracking-wide text-[10px]">{label}</div>
      <div className="font-serif text-text mt-0.5">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input type={type} className="input text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
