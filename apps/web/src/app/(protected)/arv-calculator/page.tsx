import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { ArvCalculatorClient, type InitialLead } from "./ArvCalculatorClient";

export default async function ArvCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; analysisId?: string }>;
}) {
  const user = await getAuthedUser();
  if (!user) return null;

  const { leadId, analysisId } = await searchParams;
  let lead: InitialLead | null = null;

  if (leadId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("leads")
      .select("id, seller_name, address, city, state, zip")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .single();
    lead = data ?? null;
  }

  return <ArvCalculatorClient initialLead={lead} initialAnalysisId={analysisId ?? null} />;
}
