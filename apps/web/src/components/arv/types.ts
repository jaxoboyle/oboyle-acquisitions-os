// Shared client-side ARV Calculator UI types. Mirrors the shapes returned by
// /api/arv/comps and expected by /api/arv/save's `comps` array.

export interface CompItem {
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
  similarityScore: number;
  included: boolean;
  isManual: boolean;
  source: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
}

export interface PropertyFactsState {
  formattedAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  parcelNumber: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  assessedValue: number | null;
  taxAnnualAmount: number | null;
  source: string;
  sourceId: string | null;
  retrievedAt: string;
}

export interface ArvResultState {
  low: number;
  likely: number;
  high: number;
  confidence: "high" | "medium" | "low";
  compsUsed: number;
}

export interface RepairBreakdownState {
  breakdown: Record<string, number>;
  total: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  narrative: string;
  photoCount: number;
  photoSource: string;
}

export interface HistoryEntry {
  id: string;
  address: string;
  arv_likely: number | null;
  mao: number | null;
  offer_range_low?: number | null;
  offer_range_high?: number | null;
  arv_confidence?: string | null;
  created_at: string;
}
