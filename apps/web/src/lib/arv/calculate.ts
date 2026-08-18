// Single source of truth for ARV/offer math. Imported directly by the ARV
// Calculator UI (instant client-side recalculation), the /api/arv/* routes,
// and Big Stein's ARV tools — nobody re-derives this formula independently,
// so the number shown on screen and the number persisted to the database can
// never drift apart.

export const DEFAULT_BUYER_PCT = 75;
export const DEFAULT_WHOLESALE_FEE = 15000;

export const BUYER_PCT_PRESETS = [70, 72, 75, 78, 80] as const;
export const WHOLESALE_FEE_PRESETS = [10000, 15000, 20000, 25000] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MaoInput {
  /** Likely ARV, in dollars. */
  arv: number;
  /** Buyer percentage as a whole number, e.g. 75 for 75%. */
  buyerPct: number;
  /** Repairs figure currently shown to the user (AI estimate or manual override). */
  repairs: number;
  /** Wholesale fee, in dollars. */
  wholesaleFee: number;
}

/** MAO = (ARV x buyer%) - Repairs - Wholesale Fee. */
export function calculateBuyerValue(arv: number, buyerPct: number): number {
  return round2(arv * (buyerPct / 100));
}

export function calculateMao(input: MaoInput): number {
  const buyerValue = calculateBuyerValue(input.arv, input.buyerPct);
  return round2(buyerValue - input.repairs - input.wholesaleFee);
}

export interface OfferRangeResult {
  low: number;
  high: number;
}

/**
 * Suggested starting offer is deliberately below MAO (the ceiling) so there's
 * room to negotiate up to it. Default band is 91%-97% of MAO, rounded to the
 * nearest $500 for a number a seller can actually hear over the phone.
 */
export function calculateOfferRange(
  mao: number,
  opts?: { lowPct?: number; highPct?: number }
): OfferRangeResult {
  const lowPct = opts?.lowPct ?? 0.91;
  const highPct = opts?.highPct ?? 0.97;
  const roundTo500 = (n: number) => Math.round(n / 500) * 500;
  const low = roundTo500(mao * lowPct);
  const high = roundTo500(mao * highPct);
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

export interface OfferSummary {
  arv: number;
  buyerPct: number;
  buyerValue: number;
  repairs: number;
  wholesaleFee: number;
  mao: number;
  offerRange: OfferRangeResult;
}

export function summarizeOffer(input: MaoInput): OfferSummary {
  const buyerValue = calculateBuyerValue(input.arv, input.buyerPct);
  const mao = calculateMao(input);
  return {
    arv: input.arv,
    buyerPct: input.buyerPct,
    buyerValue,
    repairs: input.repairs,
    wholesaleFee: input.wholesaleFee,
    mao,
    offerRange: calculateOfferRange(mao),
  };
}

/**
 * The repair number MAO must use is always whichever one is currently shown
 * to the user — a manual override permanently wins over the AI estimate for
 * this analysis until cleared. The AI estimate itself is preserved
 * separately (repairs_ai_estimate) purely for display/reference.
 */
export function resolveActiveRepairs(aiEstimate: number | null, manualOverride: number | null): number {
  if (manualOverride != null && !Number.isNaN(manualOverride)) return manualOverride;
  if (aiEstimate != null && !Number.isNaN(aiEstimate)) return aiEstimate;
  return 0;
}
