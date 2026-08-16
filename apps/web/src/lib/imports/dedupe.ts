import { normalizeAddress, normalizeName, normalizeParcel } from "./normalize";
import type { LeadCandidate } from "./normalize-row";

export type ExistingLeadKey = {
  id: string;
  seller_name: string | null;
  address: string | null;
  parcel_number: string | null;
};

export type DedupeIndex = {
  byParcel: Map<string, string>; // normalized parcel -> lead id
  byAddress: Map<string, string>; // normalized address -> lead id
  byNameAddress: Map<string, string>; // normalized "name|address" -> lead id
};

export function buildDedupeIndex(existing: ExistingLeadKey[]): DedupeIndex {
  const byParcel = new Map<string, string>();
  const byAddress = new Map<string, string>();
  const byNameAddress = new Map<string, string>();

  for (const lead of existing) {
    const parcel = normalizeParcel(lead.parcel_number);
    const address = normalizeAddress(lead.address);
    const name = normalizeName(lead.seller_name);

    if (parcel) byParcel.set(parcel, lead.id);
    if (address) byAddress.set(address, lead.id);
    if (name && address) byNameAddress.set(`${name}|${address}`, lead.id);
  }

  return { byParcel, byAddress, byNameAddress };
}

/** Duplicate check order, matching the spec: parcel number is the strongest
 * signal (a legal identifier), then property address alone, then owner +
 * address together. Case/punctuation/whitespace differences never count as
 * a new lead — "123 Main St." and "123 MAIN STREET" match. */
export function findDuplicateLeadId(candidate: LeadCandidate, index: DedupeIndex): string | null {
  const parcel = normalizeParcel(candidate.parcel_number);
  if (parcel && index.byParcel.has(parcel)) return index.byParcel.get(parcel)!;

  const address = normalizeAddress(candidate.address);
  if (address && index.byAddress.has(address)) return index.byAddress.get(address)!;

  const name = normalizeName(candidate.seller_name);
  if (name && address) {
    const key = `${name}|${address}`;
    if (index.byNameAddress.has(key)) return index.byNameAddress.get(key)!;
  }

  return null;
}

/** Also guards against duplicate rows WITHIN the same file (the same seller
 * listed twice in one export) — checked against rows already accepted in
 * this same import pass, not just the existing CRM. */
export function addToIndex(index: DedupeIndex, leadId: string, candidate: LeadCandidate): void {
  const parcel = normalizeParcel(candidate.parcel_number);
  const address = normalizeAddress(candidate.address);
  const name = normalizeName(candidate.seller_name);

  if (parcel) index.byParcel.set(parcel, leadId);
  if (address) index.byAddress.set(address, leadId);
  if (name && address) index.byNameAddress.set(`${name}|${address}`, leadId);
}
