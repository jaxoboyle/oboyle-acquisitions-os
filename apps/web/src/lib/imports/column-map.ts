// Fuzzy source-column → CRM-field mapping for Big Stein seller-file imports.
// "Owner", "Owner Name", "Seller", "Property Owner" all resolve to the same
// target field without requiring exact header names.

export type TargetField =
  | "seller_name"
  | "phone"
  | "email"
  | "address"
  | "mailing_address"
  | "city"
  | "county"
  | "state"
  | "zip"
  | "parcel_number"
  | "asking_price"
  | "property_type"
  | "reason_for_selling"
  | "property_condition"
  | "lead_source"
  | "occupancy"
  | "arv"
  | "repairs_needed"
  | "conversation_notes";

// Ordered so more specific aliases are checked before generic ones (e.g.
// "mailing address" must resolve before the generic "address" fallback).
const FIELD_ALIASES: Array<{ field: TargetField; aliases: string[] }> = [
  {
    field: "seller_name",
    aliases: [
      "owner", "owner name", "sellers name", "seller name", "seller",
      "property owner", "propertyowner", "name", "full name", "contact name",
      "contact", "primary owner",
    ],
  },
  { field: "phone", aliases: ["phone", "phone number", "cell", "cell phone", "mobile", "telephone", "contact phone", "phone1", "owner phone"] },
  { field: "email", aliases: ["email", "email address", "e mail", "owner email"] },
  {
    field: "mailing_address",
    aliases: ["mailing address", "mail address", "owner address", "owner mailing address", "mailing addr"],
  },
  {
    field: "address",
    aliases: [
      "property address", "situs address", "site address", "street address",
      "property", "propaddress", "address", "location",
    ],
  },
  { field: "city", aliases: ["city", "property city", "situs city"] },
  { field: "county", aliases: ["county"] },
  { field: "state", aliases: ["state", "st", "property state"] },
  { field: "zip", aliases: ["zip", "zip code", "zipcode", "postal code", "postal"] },
  { field: "parcel_number", aliases: ["apn", "parcel", "parcel number", "parcel id", "pin", "tax id", "parcel no"] },
  { field: "asking_price", aliases: ["asking price", "asking", "price", "list price", "listprice"] },
  { field: "property_type", aliases: ["property type", "prop type", "type", "property class"] },
  {
    field: "reason_for_selling",
    aliases: ["motivation", "reason for selling", "seller motivation", "reason", "why selling"],
  },
  {
    field: "property_condition",
    aliases: ["condition", "property condition", "distress", "distress information", "distressed", "distress info"],
  },
  { field: "lead_source", aliases: ["source", "lead source", "list source"] },
  { field: "occupancy", aliases: ["occupancy", "occupied"] },
  { field: "arv", aliases: ["arv", "est arv", "estimated arv", "after repair value"] },
  { field: "repairs_needed", aliases: ["repair level", "repairs needed", "repairs", "rehab level"] },
  { field: "conversation_notes", aliases: ["notes", "comments", "description", "remarks", "note"] },
];

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-/.]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Maps each raw header to a target field, or null if nothing reasonable matches.
 * Each target field is only assigned to ONE header — the first (best) match wins,
 * so a file with both "Owner" and "Owner Name" columns doesn't silently drop one. */
export function mapColumns(headers: string[]): Record<string, TargetField | null> {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Record<string, TargetField | null> = {};
  const claimedFields = new Set<TargetField>();

  for (const { field, aliases } of FIELD_ALIASES) {
    if (claimedFields.has(field)) continue;

    // Pass 1: exact normalized match.
    let match = normalizedHeaders.find(
      (h) => !(h.raw in mapping) && aliases.includes(h.norm)
    );

    // Pass 2: header contains an alias as a whole-word substring (e.g.
    // "Owner Full Name" contains "owner").
    if (!match) {
      match = normalizedHeaders.find((h) => {
        if (h.raw in mapping) return false;
        return aliases.some((a) => new RegExp(`\\b${a}\\b`).test(h.norm));
      });
    }

    if (match) {
      mapping[match.raw] = field;
      claimedFields.add(field);
    }
  }

  for (const h of headers) {
    if (!(h in mapping)) mapping[h] = null;
  }

  return mapping;
}
