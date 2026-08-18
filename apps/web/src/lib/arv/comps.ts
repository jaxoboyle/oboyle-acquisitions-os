// Comp similarity scoring and ARV derivation. Deliberately NOT a blind
// average of sold prices — weights each comp's price-per-sqft by how similar
// it is to the subject property, per O'Boyle spec section 9.

export interface SubjectProperty {
  squareFootage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
}

export interface CompCandidate {
  distanceMiles: number | null;
  soldDate: string | null; // ISO date
  squareFootage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function monthsBetween(a: Date, b: Date): number {
  return Math.abs((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * 0-100 similarity score. Distance and recency use the ≤1mi / ≤6mo
 * guidelines from spec section 6 as the "no penalty" zone, widening
 * gracefully rather than hard-cutting so a thin market still produces a
 * ranked list instead of an empty one. A property-type mismatch (condo vs.
 * single-family, etc.) is penalized heavily rather than excluded outright,
 * per spec section 7 ("unless no better data exists").
 */
export function scoreComp(comp: CompCandidate, subject: SubjectProperty, now: Date = new Date()): number {
  let score = 100;

  if (comp.distanceMiles == null) score -= 12;
  else if (comp.distanceMiles <= 1) score -= 0;
  else if (comp.distanceMiles <= 2) score -= 10;
  else if (comp.distanceMiles <= 3) score -= 20;
  else score -= 35;

  if (!comp.soldDate) {
    score -= 10;
  } else {
    const months = monthsBetween(new Date(comp.soldDate), now);
    if (months <= 6) score -= 0;
    else if (months <= 12) score -= 12;
    else score -= 28;
  }

  if (comp.squareFootage != null && subject.squareFootage) {
    const diffPct = Math.abs(comp.squareFootage - subject.squareFootage) / subject.squareFootage;
    if (diffPct <= 0.2) score -= 0;
    else if (diffPct <= 0.35) score -= 12;
    else score -= 28;
  } else {
    score -= 10;
  }

  if (subject.propertyType && comp.propertyType && normalizeType(subject.propertyType) !== normalizeType(comp.propertyType)) {
    score -= 40;
  }

  if (comp.bedrooms != null && subject.bedrooms != null) {
    score -= Math.min(Math.abs(comp.bedrooms - subject.bedrooms) * 6, 18);
  }
  if (comp.bathrooms != null && subject.bathrooms != null) {
    score -= Math.min(Math.abs(comp.bathrooms - subject.bathrooms) * 5, 15);
  }

  if (comp.yearBuilt != null && subject.yearBuilt != null) {
    const diff = Math.abs(comp.yearBuilt - subject.yearBuilt);
    if (diff > 30) score -= 10;
    else if (diff > 15) score -= 5;
  }

  return clamp(Math.round(score), 0, 100);
}

function normalizeType(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("condo")) return "condo";
  if (s.includes("townhouse") || s.includes("town home")) return "townhouse";
  if (s.includes("multi")) return "multi_family";
  if (s.includes("manufactured") || s.includes("mobile")) return "manufactured";
  return "single_family";
}

/**
 * Scores every candidate and marks the strongest (up to maxIncluded) as
 * included by default — spec section 6's "3-6 strong comps" preference.
 * Weak comps aren't dropped from the list (the user can still see/manually
 * include them in View Comps), just excluded from the default ARV math.
 */
export function selectComps<T extends CompCandidate>(
  candidates: T[],
  subject: SubjectProperty,
  maxIncluded = 6
): Array<T & { similarityScore: number; included: boolean }> {
  const scored = candidates.map((c) => ({ ...c, similarityScore: scoreComp(c, subject) }));
  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.map((c, i) => ({ ...c, included: i < maxIncluded }));
}

export interface ScoredComp {
  soldPrice: number | null;
  squareFootage: number | null;
  similarityScore: number;
  included: boolean;
}

export interface ArvResult {
  low: number;
  likely: number;
  high: number;
  confidence: "high" | "medium" | "low";
  compsUsed: number;
}

function weightedAverage(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight;
}

/**
 * ARV from included comps: weighted-average price-per-sqft (weight =
 * similarity score, floor of 1 so no comp is zeroed out entirely) applied to
 * the subject's square footage, falling back to a weighted raw-price average
 * when sqft data is missing. Confidence reflects both comp count and average
 * similarity — 3-6 strong comps is "high", per spec section 9/22.
 */
export function calculateArvFromComps(comps: ScoredComp[], subjectSqft: number | null): ArvResult | null {
  const included = comps.filter((c) => c.included && c.soldPrice != null && c.soldPrice > 0);
  if (included.length === 0) return null;

  const withSqft = included.filter((c) => c.squareFootage && c.squareFootage > 0);

  let likely: number;
  if (withSqft.length > 0 && subjectSqft) {
    const ppsValues = withSqft.map((c) => c.soldPrice! / c.squareFootage!);
    const weights = withSqft.map((c) => Math.max(c.similarityScore, 1));
    likely = weightedAverage(ppsValues, weights) * subjectSqft;
  } else {
    const weights = included.map((c) => Math.max(c.similarityScore, 1));
    likely = weightedAverage(included.map((c) => c.soldPrice!), weights);
  }

  const spread = included.length >= 4 ? 0.04 : included.length >= 2 ? 0.06 : 0.09;
  const avgScore = included.reduce((a, c) => a + c.similarityScore, 0) / included.length;

  let confidence: "high" | "medium" | "low" = "low";
  if (included.length >= 3 && avgScore >= 75) confidence = "high";
  else if (included.length >= 2 && avgScore >= 55) confidence = "medium";

  return {
    low: Math.round(likely * (1 - spread)),
    likely: Math.round(likely),
    high: Math.round(likely * (1 + spread)),
    confidence,
    compsUsed: included.length,
  };
}
