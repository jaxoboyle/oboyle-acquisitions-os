import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";

export default async function BuyersPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: buyers } = await supabase
    .from("buyers")
    .select("id, buyer_name, company_name, phone, email, areas, max_purchase_price, funding_type, proof_of_funds_status")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("buyer_name", { ascending: true });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Buyers"
        description="Cash buyers and investors ready to purchase assigned contracts."
      />

      <div className="card p-0 overflow-hidden">
        {!buyers || buyers.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No buyers yet"
            description="Your buyers list is empty — investors and cash buyers you add will appear here with their purchase criteria."
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
                  <th>Proof of funds</th>
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
                    <td className="text-text-muted">{buyer.proof_of_funds_status ?? "—"}</td>
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
