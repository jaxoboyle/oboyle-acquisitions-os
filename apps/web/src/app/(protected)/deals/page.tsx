import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { DealsClient, type DealRow } from "./DealsClient";

export default async function DealsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const [{ data: deals }, { data: leads }, { data: buyers }] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, lead_id, contract_date, earnest_money_amount, earnest_money_due_date, inspection_period_end_date, closing_date, title_company_name, title_company_phone, title_company_email, end_buyer_id, end_buyer_name, buyer_deposit, assignment_fee, title_status, closing_status, deal_stage, deal_notes, leads(seller_name, address)"
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("closing_date", { ascending: true, nullsFirst: false }),

    supabase
      .from("leads")
      .select("id, seller_name, address, asking_price, arv, estimated_repair_costs, mao")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("seller_name", { ascending: true }),

    supabase
      .from("buyers")
      .select("id, buyer_name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("buyer_name", { ascending: true }),
  ]);

  const dealRows: DealRow[] = (deals ?? []).map((d) => {
    const lead = Array.isArray(d.leads) ? d.leads[0] : d.leads;
    return {
      id: d.id,
      lead_id: d.lead_id,
      contract_date: d.contract_date,
      earnest_money_amount: d.earnest_money_amount,
      earnest_money_due_date: d.earnest_money_due_date,
      inspection_period_end_date: d.inspection_period_end_date,
      closing_date: d.closing_date,
      title_company_name: d.title_company_name,
      title_company_phone: d.title_company_phone,
      title_company_email: d.title_company_email,
      end_buyer_id: d.end_buyer_id,
      end_buyer_name: d.end_buyer_name,
      buyer_deposit: d.buyer_deposit,
      assignment_fee: d.assignment_fee,
      title_status: d.title_status,
      closing_status: d.closing_status,
      deal_stage: d.deal_stage,
      deal_notes: d.deal_notes,
      lead_seller_name: lead?.seller_name ?? "Unknown seller",
      lead_address: lead?.address ?? null,
    };
  });

  return <DealsClient deals={dealRows} leads={leads ?? []} buyers={buyers ?? []} />;
}
