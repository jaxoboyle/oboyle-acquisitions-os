import { describe, it, expect } from "vitest";
import { calculateMao, calculateOfferRange, resolveActiveRepairs, summarizeOffer } from "./calculate";

describe("calculateMao", () => {
  it("matches the spec's baseline example: ARV 300k, 75%, repairs 40k, fee 15k -> 170k", () => {
    expect(calculateMao({ arv: 300_000, buyerPct: 75, repairs: 40_000, wholesaleFee: 15_000 })).toBe(170_000);
  });

  it("raising the fee to 20k drops MAO to 165k", () => {
    expect(calculateMao({ arv: 300_000, buyerPct: 75, repairs: 40_000, wholesaleFee: 20_000 })).toBe(165_000);
  });

  it("raising repairs to 50k with a 15k fee drops MAO to 160k", () => {
    expect(calculateMao({ arv: 300_000, buyerPct: 75, repairs: 50_000, wholesaleFee: 15_000 })).toBe(160_000);
  });

  it("lowering buyer% to 70 lowers MAO", () => {
    const mao70 = calculateMao({ arv: 300_000, buyerPct: 70, repairs: 40_000, wholesaleFee: 15_000 });
    const mao75 = calculateMao({ arv: 300_000, buyerPct: 75, repairs: 40_000, wholesaleFee: 15_000 });
    expect(mao70).toBeLessThan(mao75);
    expect(mao70).toBe(300_000 * 0.7 - 40_000 - 15_000);
  });
});

describe("calculateOfferRange", () => {
  it("returns a range strictly below MAO, low < high", () => {
    const range = calculateOfferRange(170_000);
    expect(range.low).toBeLessThan(range.high);
    expect(range.high).toBeLessThanOrEqual(170_000);
  });
});

describe("resolveActiveRepairs", () => {
  it("uses the manual override when present, even if it differs from the AI estimate", () => {
    expect(resolveActiveRepairs(42_500, 55_000)).toBe(55_000);
  });

  it("falls back to the AI estimate when no override is set", () => {
    expect(resolveActiveRepairs(42_500, null)).toBe(42_500);
  });

  it("falls back to 0 when neither is set", () => {
    expect(resolveActiveRepairs(null, null)).toBe(0);
  });
});

describe("summarizeOffer", () => {
  it("MAO always reflects the currently active repairs figure, not a stale one", () => {
    const withOverride = summarizeOffer({ arv: 300_000, buyerPct: 75, repairs: resolveActiveRepairs(42_500, 55_000), wholesaleFee: 15_000 });
    expect(withOverride.repairs).toBe(55_000);
    expect(withOverride.mao).toBe(300_000 * 0.75 - 55_000 - 15_000);
  });
});
