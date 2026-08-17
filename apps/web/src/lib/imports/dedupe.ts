import { normalizeAddress, normalizeName, normalizeParcel, normalizePhone } from "./normalize";
import type { LeadCandidate } from "./normalize-row";

export type ExistingLeadKey = {
  id: string;
  seller_name: string | null;
  address: string | null;
  parcel_number: string | null;
  phone?: string | null;
};

export type DedupeIndex = {
  byParcel: Map<string, string>; // normalized parcel -> lead id
  byAddress: Map<string, string>; // normalized address -> lead id
  byNameAddress: Map<string, string>; // normalized "name|address" -> lead id
  byPhoneAddress: Map<string, string>; // normalized "phone|address" -> lead id
  byNamePhone: Map<string, string>; // normalized "name|phone" -> lead id — catches
  // records with no usable address at all (common in report-style PDF imports
  // where "Address in listing NOT SHOWN" is common but a phone was found).
  byPhone: Map<string, string>; // normalized phone alone -> lead id — last resort
  // for a record with ONLY a phone (no name, no address, no parcel); a phone
  // number is specific enough on its own to be a safe final signal.
};

function keysFor(lead: { seller_name: string | null; address: string | null; parcel_number: string | null; phone?: string | null }) {
  return {
    parcel: normalizeParcel(lead.parcel_number),
    address: normalizeAddress(lead.address),
    name: normalizeName(lead.seller_name),
    phone: normalizePhone(lead.phone ?? null),
  };
}

export function buildDedupeIndex(existing: ExistingLeadKey[]): DedupeIndex {
  const byParcel = new Map<string, string>();
  const byAddress = new Map<string, string>();
  const byNameAddress = new Map<string, string>();
  const byPhoneAddress = new Map<string, string>();
  const byNamePhone = new Map<string, string>();
  const byPhone = new Map<string, string>();

  for (const lead of existing) {
    const { parcel, address, name, phone } = keysFor(lead);

    if (parcel) byParcel.set(parcel, lead.id);
    if (address) byAddress.set(address, lead.id);
    if (name && address) byNameAddress.set(`${name}|${address}`, lead.id);
    if (phone && address) byPhoneAddress.set(`${phone}|${address}`, lead.id);
    if (name && phone) byNamePhone.set(`${name}|${phone}`, lead.id);
    if (phone) byPhone.set(phone, lead.id);
  }

  return { byParcel, byAddress, byNameAddress, byPhoneAddress, byNamePhone, byPhone };
}

/** Duplicate check order, matching the spec: parcel number is the strongest
 * signal (a legal identifier), then property address alone, then owner +
 * address, then phone + address, then owner + phone (this last one is what
 * catches a re-imported record whose address is genuinely unknown — "Address
 * in listing NOT SHOWN" — but whose owner+phone were already captured).
 * Case/punctuation/whitespace differences never count as a new lead —
 * "123 Main St." and "123 MAIN STREET" match. */
export function findDuplicateLeadId(candidate: LeadCandidate, index: DedupeIndex): string | null {
  const { parcel, address, name, phone } = keysFor(candidate);

  if (parcel && index.byParcel.has(parcel)) return index.byParcel.get(parcel)!;
  if (address && index.byAddress.has(address)) return index.byAddress.get(address)!;
  if (name && address) {
    const hit = index.byNameAddress.get(`${name}|${address}`);
    if (hit) return hit;
  }
  if (phone && address) {
    const hit = index.byPhoneAddress.get(`${phone}|${address}`);
    if (hit) return hit;
  }
  if (name && phone) {
    const hit = index.byNamePhone.get(`${name}|${phone}`);
    if (hit) return hit;
  }
  if (phone && index.byPhone.has(phone)) return index.byPhone.get(phone)!;

  return null;
}

/** Also guards against duplicate rows WITHIN the same file (the same seller
 * listed twice in one export) — checked against rows already accepted in
 * this same import pass, not just the existing CRM. */
export function addToIndex(index: DedupeIndex, leadId: string, candidate: LeadCandidate): void {
  const { parcel, address, name, phone } = keysFor(candidate);

  if (parcel) index.byParcel.set(parcel, leadId);
  if (address) index.byAddress.set(address, leadId);
  if (name && address) index.byNameAddress.set(`${name}|${address}`, leadId);
  if (phone && address) index.byPhoneAddress.set(`${phone}|${address}`, leadId);
  if (name && phone) index.byNamePhone.set(`${name}|${phone}`, leadId);
  if (phone) index.byPhone.set(phone, leadId);
}
