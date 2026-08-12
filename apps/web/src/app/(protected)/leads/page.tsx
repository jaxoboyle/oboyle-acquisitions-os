import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Users } from "lucide-react";

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, seller_name, phone, email, city, state, stage, priority, asking_price, next_follow_up_date")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("stage_order", { ascending: true });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Leads"
        description="Sellers currently in the acquisition pipeline."
      />

      <div className="card p-0 overflow-hidden">
        {!leads || leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads yet"
            description="Seller leads scraped, imported, or entered manually will appear here — nothing has been added yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Location</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Asking price</th>
                  <th>Next follow-up</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <p className="font-medium text-text">{lead.seller_name}</p>
                      <p className="text-xs text-text-subtle mt-0.5">
                        {lead.phone ?? lead.email ?? "—"}
                      </p>
                    </td>
                    <td className="text-text-muted">
                      {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <Badge variant="brand">{lead.stage.replace(/_/g, " ")}</Badge>
                    </td>
                    <td>
                      <Badge variant={PRIORITY_VARIANT[lead.priority] ?? "neutral"}>
                        {lead.priority}
                      </Badge>
                    </td>
                    <td className="font-serif text-text">{formatCurrency(lead.asking_price)}</td>
                    <td className="text-text-muted">{formatDate(lead.next_follow_up_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
