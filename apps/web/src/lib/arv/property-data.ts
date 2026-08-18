// Property records + sold comps provider. Chosen: RentCast
// (https://www.rentcast.io/api) — a single REST API key covers both the
// property-facts lookup and an AVM/sale-comps endpoint, no OAuth or approval
// process, and it's purpose-built for investor ARV workflows (the exact use
// case here) rather than a general listings API. Requires RENTCAST_API_KEY.
//
// If that key is not configured, every function here returns a clear
// "not configured" error instead of fabricating data — the rest of the ARV
// Calculator (manual property entry, manual comps, repairs, MAO math) keeps
// working without it.

const RENTCAST_BASE_URL = "https://api.rentcast.io/v1";

export class PropertyDataNotConfiguredError extends Error {
  constructor() {
    super("No property data provider is configured (missing RENTCAST_API_KEY).");
    this.name = "PropertyDataNotConfiguredError";
  }
}

function getApiKey(): string | null {
  return process.env.RENTCAST_API_KEY ?? null;
}

export function isPropertyDataConfigured(): boolean {
  return !!getApiKey();
}

async function rentcastGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new PropertyDataNotConfiguredError();

  const url = new URL(`${RENTCAST_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RentCast request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

export interface PropertyFacts {
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
  photoUrls: string[];
  source: "rentcast";
  sourceId: string | null;
  retrievedAt: string;
  raw: unknown;
}

// RentCast's /properties response shape isn't guaranteed to be stable, so
// every field read below tries a couple of plausible key names defensively
// rather than assuming one exact schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: any, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj?.[k] != null) return obj[k];
  }
  return null;
}

export async function fetchPropertyFacts(address: string): Promise<PropertyFacts | null> {
  const results = await rentcastGet<unknown>("/properties", { address, limit: 1 });
  const record = Array.isArray(results) ? results[0] : results;
  if (!record) return null;

  const taxAssessments = pick(record, "taxAssessments") as Record<string, { value?: number }> | null;
  const propertyTaxes = pick(record, "propertyTaxes") as Record<string, { total?: number }> | null;
  const latestTaxYear = taxAssessments ? Object.keys(taxAssessments).sort().pop() : null;
  const latestTaxBillYear = propertyTaxes ? Object.keys(propertyTaxes).sort().pop() : null;

  return {
    formattedAddress: (pick(record, "formattedAddress", "address") as string) ?? null,
    city: (pick(record, "city") as string) ?? null,
    state: (pick(record, "state") as string) ?? null,
    zip: (pick(record, "zipCode", "zip") as string) ?? null,
    parcelNumber: (pick(record, "assessorID", "apn", "parcelNumber") as string) ?? null,
    propertyType: (pick(record, "propertyType") as string) ?? null,
    bedrooms: (pick(record, "bedrooms") as number) ?? null,
    bathrooms: (pick(record, "bathrooms") as number) ?? null,
    squareFootage: (pick(record, "squareFootage") as number) ?? null,
    lotSizeSqft: (pick(record, "lotSize") as number) ?? null,
    yearBuilt: (pick(record, "yearBuilt") as number) ?? null,
    lastSaleDate: (pick(record, "lastSaleDate") as string) ?? null,
    lastSalePrice: (pick(record, "lastSalePrice") as number) ?? null,
    assessedValue: latestTaxYear ? taxAssessments?.[latestTaxYear]?.value ?? null : null,
    taxAnnualAmount: latestTaxBillYear ? propertyTaxes?.[latestTaxBillYear]?.total ?? null : null,
    photoUrls: [],
    source: "rentcast",
    sourceId: (pick(record, "id") as string) ?? null,
    retrievedAt: new Date().toISOString(),
    raw: record,
  };
}

export interface SaleCompCandidate {
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
  source: "rentcast";
  sourceId: string | null;
  sourceUrl: null;
  retrievedAt: string;
}

export interface AvmResult {
  estimate: number | null;
  comps: SaleCompCandidate[];
  raw: unknown;
}

/**
 * RentCast's AVM value endpoint returns both a point estimate and its raw
 * comparable set — we use ONLY the comparable set (real sold/listed
 * properties with real prices) and derive our own ARV/confidence from it via
 * lib/arv/comps.ts, rather than trusting the black-box `price` field as the
 * ARV. That keeps "where did this number come from" answerable.
 */
export async function fetchSaleComps(
  address: string,
  facts?: { propertyType?: string | null; bedrooms?: number | null; bathrooms?: number | null; squareFootage?: number | null }
): Promise<AvmResult> {
  const raw = await rentcastGet<unknown>("/avm/value", {
    address,
    propertyType: facts?.propertyType ?? undefined,
    bedrooms: facts?.bedrooms ?? undefined,
    bathrooms: facts?.bathrooms ?? undefined,
    squareFootage: facts?.squareFootage ?? undefined,
    compCount: 12,
  });

  const estimate = (pick(raw, "price") as number) ?? null;
  const compList = (pick(raw, "comparables") as unknown[]) ?? [];
  const retrievedAt = new Date().toISOString();

  const comps: SaleCompCandidate[] = compList.map((c) => ({
    address: (pick(c, "formattedAddress", "address") as string) ?? "Unknown address",
    soldPrice: (pick(c, "price", "salePrice") as number) ?? null,
    soldDate: (pick(c, "removedDate", "lastSaleDate", "listedDate") as string) ?? null,
    distanceMiles: (pick(c, "distance") as number) ?? null,
    squareFootage: (pick(c, "squareFootage") as number) ?? null,
    bedrooms: (pick(c, "bedrooms") as number) ?? null,
    bathrooms: (pick(c, "bathrooms") as number) ?? null,
    propertyType: (pick(c, "propertyType") as string) ?? null,
    yearBuilt: (pick(c, "yearBuilt") as number) ?? null,
    lotSizeSqft: (pick(c, "lotSize") as number) ?? null,
    source: "rentcast",
    sourceId: (pick(c, "id") as string) ?? null,
    sourceUrl: null,
    retrievedAt,
  }));

  return { estimate, comps, raw };
}
