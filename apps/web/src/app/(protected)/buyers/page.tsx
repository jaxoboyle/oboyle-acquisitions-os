import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { BuyersClient } from "./BuyersClient";

export default async function BuyersPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: buyers } = await supabase
    .from("buyers")
    .select(
      "id, buyer_name, company_name, phone, email, areas, property_types, max_purchase_price, max_repair_level, funding_type, proof_of_funds_status, typical_closing_speed, preferred_title_company, notes, status, last_contact_date"
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("buyer_name", { ascending: true });

  return <BuyersClient buyers={buyers ?? []} />;
}
