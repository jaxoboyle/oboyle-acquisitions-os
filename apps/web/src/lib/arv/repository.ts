// DB read/write helpers for arv_analyses / arv_comps, shared by the
// /api/arv/* routes, the ARV Calculator UI's server components, and Big
// Stein's ARV tools — one place that knows the table shape.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export interface CompRow {
  address: string;
  sold_price: number | null;
  sold_date: string | null;
  distance_miles: number | null;
  square_footage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: string | null;
  year_built: number | null;
  lot_size_sqft: number | null;
  price_per_sqft: number | null;
  similarity_score: number | null;
  included: boolean;
  is_manual: boolean;
  source: string | null;
  source_id: string | null;
  source_url: string | null;
  retrieved_at: string | null;
  notes: string | null;
}

export interface AnalysisInsert {
  lead_id: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  parcel_number: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  lot_size_sqft: number | null;
  year_built: number | null;
  last_sale_date: string | null;
  last_sale_price: number | null;
  assessed_value: number | null;
  tax_annual_amount: number | null;
  property_data_source: string | null;
  property_data_source_id: string | null;
  property_data_retrieved_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property_data_raw: any;
  arv_low: number | null;
  arv_likely: number | null;
  arv_high: number | null;
  arv_confidence: "high" | "medium" | "low" | null;
  arv_method: string | null;
  repairs_ai_estimate: number | null;
  repairs_manual_override: number | null;
  repairs_final: number | null;
  repair_confidence: "high" | "medium" | "low" | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repair_breakdown: any;
  repair_photo_source: string | null;
  repair_photos_analyzed_count: number;
  buyer_pct: number;
  wholesale_fee: number;
  mao: number | null;
  offer_range_low: number | null;
  offer_range_high: number | null;
  notes: string | null;
}

export async function saveAnalysis(
  supabase: AnySupabaseClient,
  userId: string,
  analysis: AnalysisInsert,
  comps: CompRow[]
): Promise<{ id: string } | { error: string }> {
  const { data: row, error } = await supabase
    .from("arv_analyses")
    .insert({ ...analysis, user_id: userId })
    .select("id")
    .single();

  if (error || !row) return { error: error?.message ?? "Could not save the analysis." };

  if (comps.length > 0) {
    const { error: compsError } = await supabase
      .from("arv_comps")
      .insert(comps.map((c) => ({ ...c, user_id: userId, analysis_id: row.id })));
    if (compsError) return { error: `Analysis saved but comps failed to save: ${compsError.message}` };
  }

  if (analysis.lead_id) {
    await supabase
      .from("leads")
      .update({
        arv: analysis.arv_likely,
        estimated_repair_costs: analysis.repairs_final,
        mao: analysis.mao,
        offer_amount: analysis.offer_range_high,
      })
      .eq("id", analysis.lead_id)
      .eq("user_id", userId);
  }

  return { id: row.id as string };
}

export async function getAnalysis(supabase: AnySupabaseClient, userId: string, analysisId: string) {
  const { data: analysis, error } = await supabase
    .from("arv_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .single();
  if (error || !analysis) return null;

  const { data: comps } = await supabase
    .from("arv_comps")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("similarity_score", { ascending: false });

  return { analysis, comps: comps ?? [] };
}

export async function listAnalysesForLead(supabase: AnySupabaseClient, userId: string, leadId: string) {
  const { data } = await supabase
    .from("arv_analyses")
    .select("id, address, arv_likely, mao, offer_range_low, offer_range_high, arv_confidence, created_at")
    .eq("lead_id", leadId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listRecentAnalyses(supabase: AnySupabaseClient, userId: string, limit = 10) {
  const { data } = await supabase
    .from("arv_analyses")
    .select("id, lead_id, address, arv_likely, mao, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
