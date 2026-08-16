"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { todayISO } from "@/lib/utils";

export type DispositionTarget = {
  id: string;
  seller_name: string;
};

const DISPOSITION_OPTIONS = [
  { value: "under_contract", label: "Under Contract" },
  { value: "follow_up", label: "Follow Up / Circle Back" },
  { value: "not_interested", label: "Not Interested" },
  { value: "bad_lead", label: "Bad Lead" },
  { value: "no_response", label: "No Response" },
  { value: "wrong_information", label: "Wrong Information" },
  { value: "sold", label: "Sold / Already Sold" },
  { value: "other", label: "Other" },
] as const;

type Disposition = (typeof DISPOSITION_OPTIONS)[number]["value"];

const FOLLOW_UP_SHORTCUTS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "30 days", days: 30 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function LeadDispositionDialog({
  lead,
  onClose,
  onSaved,
}: {
  lead: DispositionTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [followUpDate, setFollowUpDate] = useState(addDays(7));
  const [otherReason, setOtherReason] = useState("");
  const [notes, setNotes] = useState("");
  const [contractPrice, setContractPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function commit() {
    if (!disposition) return;
    if (disposition === "other" && !otherReason.trim()) {
      setError("Enter a reason for Other.");
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

    if (disposition === "under_contract") {
      const { error: rpcError } = await supabase.rpc("mark_lead_under_contract", {
        p_lead_id: lead.id,
        p_reason: null,
        p_notes: notes || null,
        p_contract_price: contractPrice ? Number(contractPrice) : null,
      });
      setSaving(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      onSaved();
      router.refresh();
      return;
    }

    const label = DISPOSITION_OPTIONS.find((o) => o.value === disposition)!.label;
    const reason = disposition === "other" ? otherReason.trim() : label;

    const updates: Record<string, unknown> = {
      disposition,
      disposition_reason: reason,
      disposition_notes: notes || null,
      disposed_at: new Date().toISOString(),
    };
    if (disposition === "follow_up") updates.next_follow_up_date = followUpDate;

    const { error: updateError } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", lead.id);

    if (!updateError) {
      await supabase.from("activity_log").insert({
        user_id: user.id,
        lead_id: lead.id,
        activity_type: "disposition_change",
        description: `Marked ${label}${reason !== label ? `: ${reason}` : ""}`,
      });
    }

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onSaved();
    router.refresh();
  }

  return (
    <Modal
      title={disposition ? DISPOSITION_OPTIONS.find((o) => o.value === disposition)!.label : "Close Out Lead"}
      description={disposition ? lead.seller_name : `Why are you closing out ${lead.seller_name}?`}
      onClose={onClose}
      widthClassName="max-w-md"
      closeDisabled={saving}
    >
      {!disposition ? (
        <div className="grid grid-cols-2 gap-2">
          {DISPOSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDisposition(opt.value)}
              className="text-left text-sm px-3 py-2.5 rounded border border-surface-border hover:border-brand/40 hover:bg-brand/5 text-text transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setDisposition(null)}
            className="flex items-center gap-1 text-xs text-text-subtle hover:text-text"
          >
            <ArrowLeft size={12} /> Back
          </button>

          {disposition === "follow_up" && (
            <div>
              <label className="text-xs text-text-muted block mb-1.5">When should Big Stein remind you?</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {FOLLOW_UP_SHORTCUTS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setFollowUpDate(addDays(s.days))}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      followUpDate === addDays(s.days)
                        ? "border-brand bg-brand-muted text-brand"
                        : "border-surface-border text-text-muted hover:text-text"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                className="input text-sm"
                value={followUpDate}
                min={todayISO()}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          )}

          {disposition === "other" && (
            <div>
              <label className="text-xs text-text-muted block mb-1">Reason *</label>
              <input
                className="input text-sm"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="What happened with this lead?"
              />
            </div>
          )}

          {disposition === "under_contract" && (
            <div>
              <label className="text-xs text-text-muted block mb-1">Contract Price (optional)</label>
              <input
                type="number"
                className="input text-sm"
                value={contractPrice}
                onChange={(e) => setContractPrice(e.target.value)}
                placeholder="Defaults to offer or asking price"
              />
              <p className="text-[11px] text-text-subtle mt-1">
                This creates a linked Deal and moves the lead to Under Contract. It stays connected to this lead.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted block mb-1">Notes (optional)</label>
            <textarea
              className="input text-sm min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={commit} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {disposition === "under_contract" ? "Create Deal" : "Save"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
