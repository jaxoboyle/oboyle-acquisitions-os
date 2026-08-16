"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Users, Loader2, XCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LeadFormDialog, type LeadRecord } from "@/components/leads/LeadFormDialog";
import { LeadDispositionDialog } from "@/components/leads/LeadDispositionDialog";

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const DISPOSITION_LABEL: Record<string, string> = {
  under_contract: "Under Contract",
  follow_up: "Follow Up",
  not_interested: "Not Interested",
  bad_lead: "Bad Lead",
  no_response: "No Response",
  wrong_information: "Wrong Info",
  sold: "Sold",
  other: "Closed",
};

const DISPOSITION_VARIANT: Record<string, "brand" | "warning" | "danger" | "neutral" | "success"> = {
  under_contract: "success",
  follow_up: "warning",
  not_interested: "neutral",
  bad_lead: "danger",
  no_response: "neutral",
  wrong_information: "neutral",
  sold: "success",
  other: "neutral",
};

// Dispositions that mean "done, no further action" — shown crossed out.
// under_contract (a win, links to the deal) and follow_up (still active,
// awaiting a callback) are deliberately excluded.
const CLOSED_DISPOSITIONS = new Set(["not_interested", "bad_lead", "no_response", "wrong_information", "sold", "other"]);

export function LeadsClient({ leads }: { leads: LeadRecord[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRecord | null>(null);
  const [dispositioning, setDispositioning] = useState<LeadRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(lead: LeadRecord) {
    setEditing(lead);
    setDialogOpen(true);
  }

  async function handleDelete(lead: LeadRecord) {
    if (!window.confirm(`Delete lead "${lead.seller_name}"? This removes it from every list.`)) return;
    setDeletingId(lead.id);
    const supabase = createClient();
    await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", lead.id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Leads"
        description="Sellers currently in the acquisition pipeline."
        action={
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Add Lead
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        {leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads yet"
            description="Seller leads you add will appear here — click Add Lead above to enter your first one."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Location</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Asking price</th>
                  <th>Next follow-up</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const closed = lead.disposition && CLOSED_DISPOSITIONS.has(lead.disposition);
                  return (
                  <tr key={lead.id}>
                    <td>
                      <p className={closed ? "font-medium text-text-subtle line-through" : "font-medium text-text"}>
                        {lead.seller_name}
                      </p>
                      <p className="text-xs text-text-subtle mt-0.5">{lead.phone ?? lead.email ?? "—"}</p>
                    </td>
                    <td className="text-text-muted">
                      {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <Badge variant="brand">{lead.stage.replace(/_/g, " ")}</Badge>
                    </td>
                    <td>
                      {lead.disposition ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant={DISPOSITION_VARIANT[lead.disposition] ?? "neutral"}>
                            {DISPOSITION_LABEL[lead.disposition] ?? lead.disposition}
                          </Badge>
                          {lead.disposition === "under_contract" && (
                            <Link href="/deals" className="text-text-subtle hover:text-brand" aria-label="View deal">
                              <ExternalLink size={12} />
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-subtle text-xs">Active</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={PRIORITY_VARIANT[lead.priority] ?? "neutral"}>{lead.priority}</Badge>
                    </td>
                    <td className="font-serif text-text">{formatCurrency(lead.asking_price)}</td>
                    <td className="text-text-muted">{formatDate(lead.next_follow_up_date)}</td>
                    <td>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setDispositioning(lead)}
                          className="text-text-subtle hover:text-accent transition-colors"
                          aria-label="Close out lead"
                          title="Mark as dealt with"
                        >
                          <XCircle size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(lead)}
                          className="text-text-subtle hover:text-brand transition-colors"
                          aria-label="Edit lead"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(lead)}
                          disabled={deletingId === lead.id}
                          className="text-text-subtle hover:text-danger transition-colors disabled:opacity-40"
                          aria-label="Delete lead"
                        >
                          {deletingId === lead.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && (
        <LeadFormDialog
          lead={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={() => setDialogOpen(false)}
        />
      )}

      {dispositioning && (
        <LeadDispositionDialog
          lead={dispositioning}
          onClose={() => setDispositioning(null)}
          onSaved={() => setDispositioning(null)}
        />
      )}
    </div>
  );
}
