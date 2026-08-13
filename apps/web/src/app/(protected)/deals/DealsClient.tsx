"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DealFormDialog, type DealRecord, type DealLeadOption, type DealBuyerOption } from "@/components/deals/DealFormDialog";

const STAGE_VARIANT: Record<string, "neutral" | "brand" | "warning" | "success" | "danger" | "accent"> = {
  analyzing: "neutral",
  negotiating: "warning",
  under_contract: "brand",
  finding_buyer: "brand",
  assigned: "accent",
  closing: "warning",
  closed: "success",
  dead: "danger",
};

export type DealRow = DealRecord & {
  lead_seller_name: string;
  lead_address: string | null;
};

export function DealsClient({
  deals,
  leads,
  buyers,
}: {
  deals: DealRow[];
  leads: DealLeadOption[];
  buyers: DealBuyerOption[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const usedLeadIds = new Set(deals.map((d) => d.lead_id));
  const availableLeads = leads.filter((l) => !usedLeadIds.has(l.id));

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(deal: DealRow) {
    setEditing(deal);
    setDialogOpen(true);
  }

  async function handleDelete(deal: DealRow) {
    if (!window.confirm(`Delete the deal for "${deal.lead_seller_name}"? This removes it from every list.`)) return;
    setDeletingId(deal.id);
    const supabase = createClient();
    await supabase.from("deals").update({ deleted_at: new Date().toISOString() }).eq("id", deal.id);
    setDeletingId(null);
    router.refresh();
  }

  // The lead attached to whichever deal is being edited must stay selectable
  // even though it's "used" — otherwise the picker would show nothing for it.
  const leadsForDialog = editing
    ? [...availableLeads, ...leads.filter((l) => l.id === editing.lead_id)]
    : availableLeads;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Deals"
        description="Contracts under assignment, from executed contract through closing."
        action={
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Add Deal
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        {deals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No deals yet"
            description="Connect a lead to a deal once it's under contract to track title, closing, and assignment fee through to close."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>End buyer</th>
                  <th>Stage</th>
                  <th>Closing date</th>
                  <th>Assignment fee</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <td>
                      <p className="font-medium text-text">{deal.lead_seller_name}</p>
                      <p className="text-xs text-text-subtle mt-0.5">{deal.lead_address ?? ""}</p>
                    </td>
                    <td className="text-text-muted">{deal.end_buyer_name ?? "—"}</td>
                    <td>
                      <Badge variant={STAGE_VARIANT[deal.deal_stage] ?? "neutral"}>
                        {deal.deal_stage.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="text-text-muted">{formatDate(deal.closing_date)}</td>
                    <td className="font-serif text-accent font-medium">{formatCurrency(deal.assignment_fee)}</td>
                    <td>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(deal)}
                          className="text-text-subtle hover:text-brand transition-colors"
                          aria-label="Edit deal"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(deal)}
                          disabled={deletingId === deal.id}
                          className="text-text-subtle hover:text-danger transition-colors disabled:opacity-40"
                          aria-label="Delete deal"
                        >
                          {deletingId === deal.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && (
        <DealFormDialog
          deal={editing}
          availableLeads={leadsForDialog}
          buyers={buyers}
          onClose={() => setDialogOpen(false)}
          onSaved={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
