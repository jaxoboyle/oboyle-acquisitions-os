import type { TargetField } from "./column-map";
import { cleanString, parseMoney } from "./normalize";

export type LeadCandidate = {
  seller_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  parcel_number: string | null;
  asking_price: number | null;
  property_type: string | null;
  reason_for_selling: string | null;
  property_condition: string | null;
  lead_source: string | null;
  occupancy: string | null;
  arv: number | null;
  repairs_needed: string | null;
  conversation_notes: string | null;
  raw: Record<string, string>;
  valid: boolean;
  skip_reason: string | null;
};

/** leads.address holds ONE address. The schema has no separate mailing-address
 * column (see migration 009 comments) — rather than bolt one on for a single
 * import feature, county/mailing-address/anything unmapped is folded into
 * conversation_notes as a labeled block, so nothing from the source file is
 * silently dropped. */
export function normalizeRow(
  row: Record<string, string>,
  mapping: Record<string, TargetField | null>,
  opts: { relaxValidity?: boolean } = {}
): LeadCandidate {
  const byField: Partial<Record<TargetField, string>> = {};
  const extras: string[] = [];

  for (const [header, value] of Object.entries(row)) {
    const clean = cleanString(value);
    if (!clean) continue;
    const field = mapping[header];
    if (!field) continue;

    if (field === "mailing_address") {
      extras.push(`Mailing address: ${clean}`);
    } else if (field === "county") {
      extras.push(`County: ${clean}`);
    } else if (byField[field]) {
      // Field already claimed by an earlier header with the same target —
      // keep the first value, note the extra in the overflow block.
      extras.push(`${header}: ${clean}`);
    } else {
      byField[field] = clean;
    }
  }

  let notesParts = [byField.conversation_notes, ...extras].filter(Boolean);

  let seller_name = byField.seller_name ?? null;
  const address = byField.address ?? null;
  const parcel_number = byField.parcel_number ?? null;

  // "Enough information to identify a legitimate seller/property": a name
  // AND at least one of address/parcel/phone. A bare name with nothing else
  // isn't a usable lead.
  const hasIdentifyingInfo = Boolean(address || parcel_number || byField.phone || byField.email);
  let valid = true;
  let skip_reason: string | null = null;

  if (opts.relaxValidity) {
    // Numbered/labeled property reports (Big Stein PDF Mode 2/3): the
    // source document itself already asserts "this is a distinct
    // opportunity" via its own record structure — a sparse block (e.g.
    // "Owner NF", "Address in listing NOT SHOWN") is still real research
    // work, not garbage. Only reject a block that captured literally
    // nothing at all.
    const hasAnything = Boolean(seller_name || address || parcel_number || byField.phone || byField.email || notesParts.length);
    if (!hasAnything) {
      valid = false;
      skip_reason = "Empty record — no usable fields were found in this block";
    } else if (!seller_name) {
      // leads.seller_name is NOT NULL in the schema — a transparent
      // placeholder (never a fabricated name) satisfies that constraint
      // while still making it obvious in the Leads list that the owner
      // is genuinely unknown and needs research.
      seller_name = address ? `Unverified Owner — ${address}` : "Unverified Owner (Needs Research)";
      if (!hasIdentifyingInfo) {
        notesParts = ["[Needs Research] Missing owner name and property identifiers — verify from source report.", ...notesParts];
      }
    }
  } else if (!seller_name && !address) {
    valid = false;
    skip_reason = "Missing both owner name and property address";
  } else if (!seller_name) {
    valid = false;
    skip_reason = "Missing owner/seller name";
  } else if (!hasIdentifyingInfo) {
    valid = false;
    skip_reason = "Missing property address, parcel number, and phone — not enough to identify the property";
  }

  const conversation_notes = notesParts.length ? notesParts.join("\n") : null;

  return {
    seller_name,
    phone: byField.phone ?? null,
    email: byField.email ?? null,
    address,
    city: byField.city ?? null,
    state: byField.state ?? null,
    zip: byField.zip ?? null,
    parcel_number,
    asking_price: parseMoney(byField.asking_price),
    property_type: byField.property_type ?? null,
    reason_for_selling: byField.reason_for_selling ?? null,
    property_condition: byField.property_condition ?? null,
    lead_source: byField.lead_source ?? null,
    occupancy: byField.occupancy ?? null,
    arv: parseMoney(byField.arv),
    repairs_needed: byField.repairs_needed ?? null,
    conversation_notes,
    raw: row,
    valid,
    skip_reason,
  };
}
