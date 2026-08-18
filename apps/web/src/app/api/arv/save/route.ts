import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveAnalysis, type AnalysisInsert, type CompRow } from "@/lib/arv/repository";
import { calculateMao, calculateOfferRange, resolveActiveRepairs } from "@/lib/arv/calculate";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface SaveAnalysisBody {
  leadId?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  parcelNumber?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFootage?: number | null;
  lotSizeSqft?: number | null;
  yearBuilt?: number | null;
  lastSaleDate?: string | null;
  lastSalePrice?: number | null;
  assessedValue?: number | null;
  taxAnnualAmount?: number | null;
  propertyDataSource?: string | null;
  propertyDataSourceId?: string | null;
  propertyDataRetrievedAt?: string | null;
  propertyDataRaw?: unknown;
  arvLow: number | null;
  arvLikely: number;
  arvHigh: number | null;
  arvConfidence: "high" | "medium" | "low" | null;
  arvMethod?: string | null;
  repairsAiEstimate: number | null;
  repairsManualOverride: number | null;
  repairConfidence: "high" | "medium" | "low" | null;
  repairBreakdown?: unknown;
  repairPhotoSource?: string | null;
  repairPhotosAnalyzedCount?: number;
  buyerPct: number;
  wholesaleFee: number;
  notes?: string | null;
  comps: Array<{
    address: string;
    soldPrice: number | null;
    soldDate: string | null;
    distanceMiles: number | null;
    squareFootage: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    propertyType: string | null;
    yearBuilt: number | null;
    lotSizeSqft: number | null;
    pricePerSqft: number | null;
    similarityScore: number | null;
    included: boolean;
    isManual: boolean;
    source: string | null;
    sourceId: string | null;
    sourceUrl: string | null;
    retrievedAt: string | null;
    notes?: string | null;
  }>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as SaveAnalysisBody | null;
  if (!body?.address || body.arvLikely == null || body.buyerPct == null || body.wholesaleFee == null) {
    return NextResponse.json({ error: "Missing required analysis fields." }, { status: 400 });
  }

  if (body.leadId) {
    const { data: lead } = await supabase.from("leads").select("id").eq("id", body.leadId).eq("user_id", user.id).single();
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const repairsFinal = resolveActiveRepairs(body.repairsAiEstimate, body.repairsManualOverride);
  const mao = calculateMao({ arv: body.arvLikely, buyerPct: body.buyerPct, repairs: repairsFinal, wholesaleFee: body.wholesaleFee });
  const offerRange = calculateOfferRange(mao);

  const insert: AnalysisInsert = {
    lead_id: body.leadId ?? null,
    address: body.address,
    city: body.city ?? null,
    state: body.state ?? null,
    zip: body.zip ?? null,
    parcel_number: body.parcelNumber ?? null,
    property_type: body.propertyType ?? null,
    bedrooms: body.bedrooms ?? null,
    bathrooms: body.bathrooms ?? null,
    square_footage: body.squareFootage ?? null,
    lot_size_sqft: body.lotSizeSqft ?? null,
    year_built: body.yearBuilt ?? null,
    last_sale_date: body.lastSaleDate ?? null,
    last_sale_price: body.lastSalePrice ?? null,
    assessed_value: body.assessedValue ?? null,
    tax_annual_amount: body.taxAnnualAmount ?? null,
    property_data_source: body.propertyDataSource ?? null,
    property_data_source_id: body.propertyDataSourceId ?? null,
    property_data_retrieved_at: body.propertyDataRetrievedAt ?? null,
    property_data_raw: body.propertyDataRaw ?? null,
    arv_low: body.arvLow ?? null,
    arv_likely: body.arvLikely,
    arv_high: body.arvHigh ?? null,
    arv_confidence: body.arvConfidence ?? null,
    arv_method: body.arvMethod ?? null,
    repairs_ai_estimate: body.repairsAiEstimate ?? null,
    repairs_manual_override: body.repairsManualOverride ?? null,
    repairs_final: repairsFinal,
    repair_confidence: body.repairConfidence ?? null,
    repair_breakdown: body.repairBreakdown ?? null,
    repair_photo_source: body.repairPhotoSource ?? null,
    repair_photos_analyzed_count: body.repairPhotosAnalyzedCount ?? 0,
    buyer_pct: body.buyerPct,
    wholesale_fee: body.wholesaleFee,
    mao,
    offer_range_low: offerRange.low,
    offer_range_high: offerRange.high,
    notes: body.notes ?? null,
  };

  const comps: CompRow[] = body.comps.map((c) => ({
    address: c.address,
    sold_price: c.soldPrice,
    sold_date: c.soldDate,
    distance_miles: c.distanceMiles,
    square_footage: c.squareFootage,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    property_type: c.propertyType,
    year_built: c.yearBuilt,
    lot_size_sqft: c.lotSizeSqft,
    price_per_sqft: c.pricePerSqft,
    similarity_score: c.similarityScore,
    included: c.included,
    is_manual: c.isManual,
    source: c.source,
    source_id: c.sourceId,
    source_url: c.sourceUrl,
    retrieved_at: c.retrievedAt,
    notes: c.notes ?? null,
  }));

  const result = await saveAnalysis(supabase, user.id, insert, comps);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ id: result.id, mao, offerRange });
}
