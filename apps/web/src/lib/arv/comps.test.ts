import { describe, it, expect } from "vitest";
import { scoreComp, selectComps, calculateArvFromComps, type CompCandidate, type SubjectProperty } from "./comps";

const subject: SubjectProperty = {
  squareFootage: 1800,
  bedrooms: 3,
  bathrooms: 2,
  propertyType: "Single Family",
  yearBuilt: 1995,
};

const now = new Date("2026-08-18T00:00:00Z");

describe("scoreComp", () => {
  it("ranks a recent, nearby, similar comp higher than a distant, old, dissimilar one", () => {
    const strong: CompCandidate = {
      distanceMiles: 0.4,
      soldDate: "2026-05-01",
      squareFootage: 1850,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: "Single Family",
      yearBuilt: 1998,
    };
    const weak: CompCandidate = {
      distanceMiles: 6,
      soldDate: "2024-01-01",
      squareFootage: 3200,
      bedrooms: 5,
      bathrooms: 4,
      propertyType: "Single Family",
      yearBuilt: 1960,
    };
    expect(scoreComp(strong, subject, now)).toBeGreaterThan(scoreComp(weak, subject, now));
  });

  it("penalizes a property-type mismatch heavily", () => {
    const sameType: CompCandidate = { distanceMiles: 0.5, soldDate: "2026-06-01", squareFootage: 1800, bedrooms: 3, bathrooms: 2, propertyType: "Single Family", yearBuilt: 1995 };
    const condo: CompCandidate = { ...sameType, propertyType: "Condo" };
    expect(scoreComp(condo, subject, now)).toBeLessThan(scoreComp(sameType, subject, now) - 20);
  });
});

describe("selectComps", () => {
  it("marks only the strongest comps included by default, capped at maxIncluded", () => {
    const candidates: CompCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      distanceMiles: i * 0.5,
      soldDate: "2026-06-01",
      squareFootage: 1800,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: "Single Family",
      yearBuilt: 1995,
    }));
    const selected = selectComps(candidates, subject, 6);
    const included = selected.filter((c) => c.included);
    const excluded = selected.filter((c) => !c.included);
    expect(included).toHaveLength(6);
    // every included comp should be at least as close as every excluded one
    const maxIncludedDistance = Math.max(...included.map((c) => c.distanceMiles!));
    const minExcludedDistance = Math.min(...excluded.map((c) => c.distanceMiles!));
    expect(maxIncludedDistance).toBeLessThanOrEqual(minExcludedDistance);
  });
});

describe("calculateArvFromComps", () => {
  it("excluding a comp changes the ARV result", () => {
    const comps = [
      { soldPrice: 300_000, squareFootage: 1800, similarityScore: 90, included: true },
      { soldPrice: 305_000, squareFootage: 1820, similarityScore: 85, included: true },
      { soldPrice: 450_000, squareFootage: 1800, similarityScore: 40, included: true }, // outlier, weak match
    ];
    const withOutlier = calculateArvFromComps(comps, 1800)!;
    const withoutOutlier = calculateArvFromComps(
      comps.map((c, i) => (i === 2 ? { ...c, included: false } : c)),
      1800
    )!;
    expect(withoutOutlier.likely).not.toBe(withOutlier.likely);
    expect(withoutOutlier.likely).toBeLessThan(withOutlier.likely);
  });

  it("returns null when no comps are included", () => {
    const comps = [{ soldPrice: 300_000, squareFootage: 1800, similarityScore: 90, included: false }];
    expect(calculateArvFromComps(comps, 1800)).toBeNull();
  });

  it("produces lower confidence for a thin, weak comp set than a strong one", () => {
    const strongSet = [
      { soldPrice: 300_000, squareFootage: 1800, similarityScore: 90, included: true },
      { soldPrice: 305_000, squareFootage: 1820, similarityScore: 88, included: true },
      { soldPrice: 298_000, squareFootage: 1790, similarityScore: 85, included: true },
    ];
    const weakSet = [{ soldPrice: 300_000, squareFootage: 1800, similarityScore: 35, included: true }];

    const strongResult = calculateArvFromComps(strongSet, 1800)!;
    const weakResult = calculateArvFromComps(weakSet, 1800)!;

    expect(strongResult.confidence).toBe("high");
    expect(weakResult.confidence).toBe("low");
  });
});
