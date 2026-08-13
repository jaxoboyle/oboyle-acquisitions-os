import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { LeadsClient } from "./LeadsClient";

export default async function LeadsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, seller_name, phone, email, address, city, state, zip, lead_source, asking_price, arv, estimated_repair_costs, reason_for_selling, property_condition, desired_timeline, conversation_notes, stage, priority, last_contact_date, next_follow_up_date"
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("stage_order", { ascending: true });

  return <LeadsClient leads={leads ?? []} />;
}
