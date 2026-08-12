import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

const CLOSING_VARIANT: Record<string, "neutral" | "brand" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  scheduled: "brand",
  delayed: "warning",
  closed: "success",
  fell_through: "danger",
};

export default async function DealsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: deals } = await supabase
    .from("deals")
    .select("id, contract_date, closing_date, title_status, closing_status, end_buyer_name, assignment_fee, leads(seller_name, address)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("closing_date", { ascending: true, nullsFirst: false });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Deals"
        description="Contracts under assignment, from executed contract through closing."
      />

      <div className="card p-0 overflow-hidden">
        {!deals || deals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No deals yet"
            description="Once a lead's contract is signed, it moves here to track title, closing, and assignment fee through to close."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>End buyer</th>
                  <th>Title</th>
                  <th>Closing</th>
                  <th>Closing date</th>
                  <th>Assignment fee</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => {
                  const lead = Array.isArray(deal.leads) ? deal.leads[0] : deal.leads;
                  return (
                    <tr key={deal.id}>
                      <td>
                        <p className="font-medium text-text">{lead?.seller_name ?? "—"}</p>
                        <p className="text-xs text-text-subtle mt-0.5">{lead?.address ?? ""}</p>
                      </td>
                      <td className="text-text-muted">{deal.end_buyer_name ?? "—"}</td>
                      <td className="text-text-muted capitalize">{deal.title_status.replace(/_/g, " ")}</td>
                      <td>
                        <Badge variant={CLOSING_VARIANT[deal.closing_status] ?? "neutral"}>
                          {deal.closing_status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="text-text-muted">{formatDate(deal.closing_date)}</td>
                      <td className="font-serif text-accent font-medium">
                        {formatCurrency(deal.assignment_fee)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
