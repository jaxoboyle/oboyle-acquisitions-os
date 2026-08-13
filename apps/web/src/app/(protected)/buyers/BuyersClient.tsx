"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { BuyerFormDialog, type BuyerRecord } from "@/components/buyers/BuyerFormDialog";

const STATUS_VARIANT: Record<string, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  do_not_contact: "danger",
};

export function BuyersClient({ buyers }: { buyers: BuyerRecord[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BuyerRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(buyer: BuyerRecord) {
    setEditing(buyer);
    setDialogOpen(true);
  }

  async function handleDelete(buyer: BuyerRecord) {
    if (!window.confirm(`Delete buyer "${buyer.buyer_name}"? This removes it from every list.`)) return;
    setDeletingId(buyer.id);
    const supabase = createClient();
    await supabase.from("buyers").update({ deleted_at: new Date().toISOString() }).eq("id", buyer.id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Buyers"
        description="Cash buyers and investors ready to purchase assigned contracts."
        action={
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Add Buyer
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        {buyers.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No buyers yet"
            description="Investors and cash buyers you add will appear here with their purchase criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Areas</th>
                  <th>Max price</th>
                  <th>Funding</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {buyers.map((buyer) => (
                  <tr key={buyer.id}>
                    <td>
                      <p className="font-medium text-text">{buyer.buyer_name}</p>
                      <p className="text-xs text-text-subtle mt-0.5">
                        {buyer.company_name ?? buyer.phone ?? buyer.email ?? "—"}
                      </p>
                    </td>
                    <td className="text-text-muted">{buyer.areas ?? "—"}</td>
                    <td className="font-serif text-text">{formatCurrency(buyer.max_purchase_price)}</td>
                    <td>
                      <Badge variant="neutral">{buyer.funding_type}</Badge>
                    </td>
                    <td>
                      <Badge variant={STATUS_VARIANT[buyer.status] ?? "neutral"}>{buyer.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(buyer)}
                          className="text-text-subtle hover:text-brand transition-colors"
                          aria-label="Edit buyer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(buyer)}
                          disabled={deletingId === buyer.id}
                          className="text-text-subtle hover:text-danger transition-colors disabled:opacity-40"
                          aria-label="Delete buyer"
                        >
                          {deletingId === buyer.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
        <BuyerFormDialog
          buyer={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
